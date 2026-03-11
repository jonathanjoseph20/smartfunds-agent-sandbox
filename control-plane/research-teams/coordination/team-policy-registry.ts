import fs from 'node:fs';
import path from 'node:path';

import {
  TEAM_RESPONSE_PRIORITIES,
  type TeamPriorityRules,
  type TeamResponsePolicy,
  type TeamRoutingRule,
  type TeamStabilizationRules,
  TeamCoordinationError
} from './team-coordination-types.ts';

export const DEFAULT_TEAM_POLICY_DEFINITIONS_DIR = 'control-plane/research-teams/policies';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asPriority(value: unknown, fieldName: string): TeamPriorityRules[keyof TeamPriorityRules] {
  const candidate = asTrimmedString(value);
  if (!candidate || !(TEAM_RESPONSE_PRIORITIES as readonly string[]).includes(candidate)) {
    throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${fieldName} must be one of: ${TEAM_RESPONSE_PRIORITIES.join(', ')}.`);
  }
  return candidate as TeamPriorityRules[keyof TeamPriorityRules];
}

function validateRoutingRules(value: unknown, sourceLabel: string): TeamRoutingRule[] {
  if (!Array.isArray(value)) {
    throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${sourceLabel} routingRules must be an array.`);
  }

  const rules = value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${sourceLabel} routingRules[${String(index)}] must be an object.`);
    }

    const cohort = asTrimmedString(entry.cohort);
    const investigationTemplate = asTrimmedString(entry.investigationTemplate);

    if (!cohort || !investigationTemplate) {
      throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${sourceLabel} routingRules[${String(index)}] must define non-empty cohort and investigationTemplate.`);
    }

    return {
      cohort,
      investigationTemplate
    };
  });

  return rules.sort((left, right) => {
    const cohortCmp = left.cohort.localeCompare(right.cohort);
    if (cohortCmp !== 0) {
      return cohortCmp;
    }
    return left.investigationTemplate.localeCompare(right.investigationTemplate);
  });
}

function validatePriorityRules(value: unknown, sourceLabel: string): TeamPriorityRules {
  if (!isRecord(value)) {
    throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${sourceLabel} priorityRules must be an object.`);
  }

  return {
    escalated: asPriority(value.escalated, `${sourceLabel} priorityRules.escalated`),
    conflicted: asPriority(value.conflicted, `${sourceLabel} priorityRules.conflicted`),
    failure: asPriority(value.failure, `${sourceLabel} priorityRules.failure`)
  };
}

function validateStabilizationRules(value: unknown, sourceLabel: string): TeamStabilizationRules {
  if (!isRecord(value)) {
    throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${sourceLabel} stabilizationRules must be an object.`);
  }

  const requiredHealthySlots = value.requiredHealthySlots;
  const requireResolvedInvestigations = value.requireResolvedInvestigations;
  const requireClearedConflicts = value.requireClearedConflicts;

  if (!Number.isInteger(requiredHealthySlots) || Number(requiredHealthySlots) < 0) {
    throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${sourceLabel} stabilizationRules.requiredHealthySlots must be a non-negative integer.`);
  }
  if (typeof requireResolvedInvestigations !== 'boolean') {
    throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${sourceLabel} stabilizationRules.requireResolvedInvestigations must be a boolean.`);
  }
  if (typeof requireClearedConflicts !== 'boolean') {
    throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${sourceLabel} stabilizationRules.requireClearedConflicts must be a boolean.`);
  }

  return {
    requiredHealthySlots: Number(requiredHealthySlots),
    requireResolvedInvestigations,
    requireClearedConflicts
  };
}

export function validateTeamResponsePolicy(value: unknown, sourceLabel = '<inline>'): TeamResponsePolicy {
  if (!isRecord(value)) {
    throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${sourceLabel} must be an object.`);
  }

  const teamId = asTrimmedString(value.teamId);
  if (!teamId) {
    throw new TeamCoordinationError('TEAM_POLICY_INVALID_DEFINITION', `Team policy ${sourceLabel} teamId must be a non-empty string.`);
  }

  return {
    teamId,
    routingRules: validateRoutingRules(value.routingRules, sourceLabel),
    priorityRules: validatePriorityRules(value.priorityRules, sourceLabel),
    stabilizationRules: validateStabilizationRules(value.stabilizationRules, sourceLabel)
  };
}

export function loadTeamResponsePolicies(options: { definitionsDir?: string } = {}): TeamResponsePolicy[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_TEAM_POLICY_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new TeamCoordinationError('TEAM_POLICY_DEFINITIONS_NOT_FOUND', `Team policy definitions directory not found: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validateTeamResponsePolicy(parsed, entry);
    })
    .sort((left, right) => left.teamId.localeCompare(right.teamId));
}

export function createTeamPolicyRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadTeamResponsePolicies({ definitionsDir: options.definitionsDir });
  const byTeamId = new Map<string, TeamResponsePolicy>();

  for (const definition of definitions) {
    if (byTeamId.has(definition.teamId)) {
      throw new TeamCoordinationError('TEAM_POLICY_DUPLICATE_DEFINITION', `Duplicate team policy detected for teamId: ${definition.teamId}`);
    }
    byTeamId.set(definition.teamId, definition);
  }

  function listPolicies(): TeamResponsePolicy[] {
    return Array.from(byTeamId.values()).sort((left, right) => left.teamId.localeCompare(right.teamId));
  }

  function getPolicy(teamId: string): TeamResponsePolicy {
    const found = byTeamId.get(teamId);
    if (!found) {
      throw new TeamCoordinationError('TEAM_POLICY_NOT_FOUND', `Team policy not found: ${teamId}`);
    }
    return found;
  }

  return {
    listPolicies,
    getPolicy
  };
}

export type TeamPolicyRegistry = ReturnType<typeof createTeamPolicyRegistry>;
