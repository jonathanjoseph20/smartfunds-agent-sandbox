import { loadMissionDefinitions } from '../missions/mission-registry.ts';
import { listMissionTemplates } from '../missions/templates/mission-template-registry.ts';

import type {
  TeamDefinition as RegistryTeamDefinition,
  TeamValidationIssue,
} from './team-definition-types.ts';
import {
  TEAM_AVAILABILITY_STATES,
  TEAM_LIFECYCLE_STATES,
  TEAM_OPERATING_MODES,
  TEAM_READINESS_STATES,
  TEAM_ROSTER_POLICY_TYPES,
  TEAM_TYPES,
  type TeamDefinition,
  type TeamExecutionMode,
} from './team-types.ts';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (!isStringArray(value)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return value;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseExecutionMode(value: unknown, label: string): TeamExecutionMode {
  if (value === 'structured' || value === 'autonomous') {
    return value;
  }
  throw new Error(`${label} must be "structured" or "autonomous".`);
}

function parseOptionalStringArray(value: unknown, label: string): string[] {
  if (value === undefined) {
    return [];
  }
  return sortedUnique(ensureStringArray(value, label));
}

// Legacy validator surface (kept for runtime compatibility).
export function validateTeamDefinition(value: unknown, knownAgentIds: Set<string> = new Set()): TeamDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Team definition must be an object.');
  }

  const record = value as Record<string, unknown>;

  assertNonEmptyString(record.teamId, 'teamId');
  assertNonEmptyString(record.name, `Team ${record.teamId} name`);
  assertNonEmptyString(record.projectId, `Team ${record.teamId} projectId`);

  const members = ensureStringArray(record.members, `Team ${record.teamId} members`);
  if (members.length === 0) {
    throw new Error(`Team ${record.teamId} members must contain at least one agentId.`);
  }

  const duplicates = members.filter((member, index) => members.indexOf(member) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Team ${record.teamId} has duplicate members: ${sortedUnique(duplicates).join(', ')}.`);
  }

  const missingMembers = members.filter((member) => knownAgentIds.size > 0 && !knownAgentIds.has(member));
  if (missingMembers.length > 0) {
    throw new Error(`Team ${record.teamId} references unknown agent profiles: ${sortedUnique(missingMembers).join(', ')}.`);
  }

  return {
    teamId: record.teamId,
    name: record.name,
    projectId: record.projectId,
    members: sortedUnique(members),
    executionMode: parseExecutionMode(record.executionMode, `Team ${record.teamId} executionMode`),
    ...(isNonEmptyString(record.description) ? { description: record.description } : {}),
    ...(isNonEmptyString(record.teamObjective) ? { teamObjective: record.teamObjective } : {}),
    defaultWorkflowIds: parseOptionalStringArray(
      record.defaultWorkflowIds,
      `Team ${record.teamId} defaultWorkflowIds`,
    ),
    constraints: parseOptionalStringArray(record.constraints, `Team ${record.teamId} constraints`),
    handoffRules: parseOptionalStringArray(record.handoffRules, `Team ${record.teamId} handoffRules`),
    ...(isNonEmptyString(record.notes) ? { notes: record.notes } : {}),
  };
}

export function validateTeamDefinitions(values: unknown[], knownAgentIds: Set<string> = new Set()): TeamDefinition[] {
  const validated = values.map((value) => validateTeamDefinition(value, knownAgentIds));
  const ids = validated.map((team) => team.teamId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  if (duplicates.length > 0) {
    throw new Error(`Duplicate teamId detected: ${sortedUnique(duplicates).join(', ')}.`);
  }

  return [...validated].sort((left, right) => left.teamId.localeCompare(right.teamId));
}

export interface TeamValidationResult {
  valid: boolean;
  issues: TeamValidationIssue[];
}

export interface TeamValidatorReferenceContext {
  knownMissionTypes: Set<string>;
  knownTemplateIds: Set<string>;
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function pushIssue(issues: TeamValidationIssue[], input: TeamValidationIssue): void {
  issues.push(input);
}

function hasDuplicates(values: string[]): string[] {
  return uniqueSorted(values.filter((entry, index) => values.indexOf(entry) !== index));
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry) => entry.length > 0);
}

export function buildTeamValidatorReferenceContext(): TeamValidatorReferenceContext {
  const knownMissionTypes = new Set(
    loadMissionDefinitions()
      .map((definition) => definition.missionType)
      .sort((left, right) => left.localeCompare(right)),
  );

  const knownTemplateIds = new Set(
    listMissionTemplates()
      .map((template) => template.templateId)
      .sort((left, right) => left.localeCompare(right)),
  );

  return {
    knownMissionTypes,
    knownTemplateIds,
  };
}

export function validateTeamRegistryDefinition(
  value: unknown,
  context: TeamValidatorReferenceContext,
  sourceLabel = '<inline>',
): TeamValidationResult {
  const issues: TeamValidationIssue[] = [];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      valid: false,
      issues: [{
        teamId: sourceLabel,
        field: 'definition',
        code: 'invalid_type',
        message: `${sourceLabel} definition must be an object.`,
      }],
    };
  }

  const record = value as Record<string, unknown>;
  const teamId = asTrimmedString(record.teamId) || sourceLabel;

  const requiredStringFields = [
    'teamId',
    'displayName',
    'description',
    'teamType',
    'purpose',
    'defaultOperatingMode',
    'lifecycleState',
    'availabilityState',
    'readinessState',
  ];

  for (const field of requiredStringFields) {
    if (asTrimmedString(record[field]).length === 0) {
      pushIssue(issues, {
        teamId,
        field,
        code: 'required',
        message: `${sourceLabel} ${field} must be a non-empty string.`,
      });
    }
  }

  const requiredArrayFields = [
    'domainTags',
    'supportedMissionTypes',
    'supportedTemplateIds',
    'capabilityTags',
    'notes',
  ];

  for (const field of requiredArrayFields) {
    if (!Array.isArray(record[field])) {
      pushIssue(issues, {
        teamId,
        field,
        code: 'required_array',
        message: `${sourceLabel} ${field} must be an array of non-empty strings.`,
      });
      continue;
    }

    const normalized = normalizeArray(record[field]);
    if (normalized.length === 0) {
      pushIssue(issues, {
        teamId,
        field,
        code: 'required_non_empty',
        message: `${sourceLabel} ${field} must contain at least one value.`,
      });
    }
  }

  const teamType = asTrimmedString(record.teamType);
  if (teamType.length > 0 && !TEAM_TYPES.includes(teamType as (typeof TEAM_TYPES)[number])) {
    pushIssue(issues, {
      teamId,
      field: 'teamType',
      code: 'invalid_enum',
      message: `${sourceLabel} teamType must be one of ${TEAM_TYPES.join(', ')}.`,
    });
  }

  const defaultOperatingMode = asTrimmedString(record.defaultOperatingMode);
  if (defaultOperatingMode.length > 0 && !TEAM_OPERATING_MODES.includes(defaultOperatingMode as (typeof TEAM_OPERATING_MODES)[number])) {
    pushIssue(issues, {
      teamId,
      field: 'defaultOperatingMode',
      code: 'invalid_enum',
      message: `${sourceLabel} defaultOperatingMode must be one of ${TEAM_OPERATING_MODES.join(', ')}.`,
    });
  }

  const lifecycleState = asTrimmedString(record.lifecycleState);
  if (lifecycleState.length > 0 && !TEAM_LIFECYCLE_STATES.includes(lifecycleState as (typeof TEAM_LIFECYCLE_STATES)[number])) {
    pushIssue(issues, {
      teamId,
      field: 'lifecycleState',
      code: 'invalid_enum',
      message: `${sourceLabel} lifecycleState must be one of ${TEAM_LIFECYCLE_STATES.join(', ')}.`,
    });
  }

  const availabilityState = asTrimmedString(record.availabilityState);
  if (availabilityState.length > 0 && !TEAM_AVAILABILITY_STATES.includes(availabilityState as (typeof TEAM_AVAILABILITY_STATES)[number])) {
    pushIssue(issues, {
      teamId,
      field: 'availabilityState',
      code: 'invalid_enum',
      message: `${sourceLabel} availabilityState must be one of ${TEAM_AVAILABILITY_STATES.join(', ')}.`,
    });
  }

  const readinessState = asTrimmedString(record.readinessState);
  if (readinessState.length > 0 && !TEAM_READINESS_STATES.includes(readinessState as (typeof TEAM_READINESS_STATES)[number])) {
    pushIssue(issues, {
      teamId,
      field: 'readinessState',
      code: 'invalid_enum',
      message: `${sourceLabel} readinessState must be one of ${TEAM_READINESS_STATES.join(', ')}.`,
    });
  }

  const domainTags = normalizeArray(record.domainTags);
  const capabilityTags = normalizeArray(record.capabilityTags);
  const supportedMissionTypes = normalizeArray(record.supportedMissionTypes);
  const supportedTemplateIds = normalizeArray(record.supportedTemplateIds);

  if (capabilityTags.length === 0) {
    pushIssue(issues, {
      teamId,
      field: 'capabilityTags',
      code: 'missing_required_capabilities',
      message: `${sourceLabel} capabilityTags must include at least one capability.`,
    });
  }

  const duplicateDomainTags = hasDuplicates(domainTags);
  if (duplicateDomainTags.length > 0) {
    pushIssue(issues, {
      teamId,
      field: 'domainTags',
      code: 'duplicate_entries',
      message: `${sourceLabel} domainTags contains duplicates: ${duplicateDomainTags.join(', ')}.`,
    });
  }

  const duplicateCapabilityTags = hasDuplicates(capabilityTags);
  if (duplicateCapabilityTags.length > 0) {
    pushIssue(issues, {
      teamId,
      field: 'capabilityTags',
      code: 'duplicate_entries',
      message: `${sourceLabel} capabilityTags contains duplicates: ${duplicateCapabilityTags.join(', ')}.`,
    });
  }

  const duplicateMissionTypes = hasDuplicates(supportedMissionTypes);
  if (duplicateMissionTypes.length > 0) {
    pushIssue(issues, {
      teamId,
      field: 'supportedMissionTypes',
      code: 'duplicate_entries',
      message: `${sourceLabel} supportedMissionTypes contains duplicates: ${duplicateMissionTypes.join(', ')}.`,
    });
  }

  const duplicateTemplateIds = hasDuplicates(supportedTemplateIds);
  if (duplicateTemplateIds.length > 0) {
    pushIssue(issues, {
      teamId,
      field: 'supportedTemplateIds',
      code: 'duplicate_entries',
      message: `${sourceLabel} supportedTemplateIds contains duplicates: ${duplicateTemplateIds.join(', ')}.`,
    });
  }

  for (const missionType of uniqueSorted(supportedMissionTypes)) {
    if (!context.knownMissionTypes.has(missionType)) {
      pushIssue(issues, {
        teamId,
        field: 'supportedMissionTypes',
        code: 'invalid_mission_type_reference',
        message: `${sourceLabel} supportedMissionTypes contains unknown mission type: ${missionType}.`,
      });
    }
  }

  for (const templateId of uniqueSorted(supportedTemplateIds)) {
    if (!context.knownTemplateIds.has(templateId)) {
      pushIssue(issues, {
        teamId,
        field: 'supportedTemplateIds',
        code: 'invalid_template_reference',
        message: `${sourceLabel} supportedTemplateIds contains unknown template id: ${templateId}.`,
      });
    }
  }

  const rosterPolicy = record.rosterPolicy;
  if (!rosterPolicy || typeof rosterPolicy !== 'object' || Array.isArray(rosterPolicy)) {
    pushIssue(issues, {
      teamId,
      field: 'rosterPolicy',
      code: 'required',
      message: `${sourceLabel} rosterPolicy must be an object.`,
    });
  } else {
    const policy = rosterPolicy as Record<string, unknown>;
    const policyType = asTrimmedString(policy.type);
    const minAgents = policy.minAgents;
    const maxAgents = policy.maxAgents;
    const requiredCapabilities = normalizeArray(policy.requiredCapabilities);

    if (!TEAM_ROSTER_POLICY_TYPES.includes(policyType as (typeof TEAM_ROSTER_POLICY_TYPES)[number])) {
      pushIssue(issues, {
        teamId,
        field: 'rosterPolicy.type',
        code: 'invalid_enum',
        message: `${sourceLabel} rosterPolicy.type must be one of ${TEAM_ROSTER_POLICY_TYPES.join(', ')}.`,
      });
    }

    if (typeof minAgents !== 'number' || !Number.isInteger(minAgents) || minAgents < 0) {
      pushIssue(issues, {
        teamId,
        field: 'rosterPolicy.minAgents',
        code: 'invalid_number',
        message: `${sourceLabel} rosterPolicy.minAgents must be a non-negative integer.`,
      });
    }

    if (typeof maxAgents !== 'number' || !Number.isInteger(maxAgents) || maxAgents < 0) {
      pushIssue(issues, {
        teamId,
        field: 'rosterPolicy.maxAgents',
        code: 'invalid_number',
        message: `${sourceLabel} rosterPolicy.maxAgents must be a non-negative integer.`,
      });
    }

    if (typeof minAgents === 'number' && typeof maxAgents === 'number' && minAgents > maxAgents) {
      pushIssue(issues, {
        teamId,
        field: 'rosterPolicy',
        code: 'invalid_bounds',
        message: `${sourceLabel} rosterPolicy.minAgents cannot exceed rosterPolicy.maxAgents.`,
      });
    }

    if (!Array.isArray(policy.requiredCapabilities)) {
      pushIssue(issues, {
        teamId,
        field: 'rosterPolicy.requiredCapabilities',
        code: 'required_array',
        message: `${sourceLabel} rosterPolicy.requiredCapabilities must be an array of strings.`,
      });
    }

    const duplicateRequiredCapabilities = hasDuplicates(requiredCapabilities);
    if (duplicateRequiredCapabilities.length > 0) {
      pushIssue(issues, {
        teamId,
        field: 'rosterPolicy.requiredCapabilities',
        code: 'duplicate_entries',
        message: `${sourceLabel} rosterPolicy.requiredCapabilities contains duplicates: ${duplicateRequiredCapabilities.join(', ')}.`,
      });
    }
  }

  if (lifecycleState === 'archived' && availabilityState === 'available') {
    pushIssue(issues, {
      teamId,
      field: 'availabilityState',
      code: 'archived_team_available',
      message: `${sourceLabel} archived teams cannot be marked available.`,
    });
  }

  if (lifecycleState === 'defined' && availabilityState === 'available') {
    pushIssue(issues, {
      teamId,
      field: 'availabilityState',
      code: 'invalid_lifecycle_availability_combination',
      message: `${sourceLabel} defined teams cannot be marked available.`,
    });
  }

  return {
    valid: issues.length === 0,
    issues: issues
      .sort((left, right) => {
        const teamCmp = left.teamId.localeCompare(right.teamId);
        if (teamCmp !== 0) {
          return teamCmp;
        }
        const fieldCmp = left.field.localeCompare(right.field);
        if (fieldCmp !== 0) {
          return fieldCmp;
        }
        const codeCmp = left.code.localeCompare(right.code);
        if (codeCmp !== 0) {
          return codeCmp;
        }
        return left.message.localeCompare(right.message);
      }),
  };
}

export function validateTeamRegistryDefinitions(
  values: unknown[],
  context: TeamValidatorReferenceContext,
): { valid: boolean; definitions: RegistryTeamDefinition[]; issues: TeamValidationIssue[] } {
  const issues: TeamValidationIssue[] = [];
  const definitions: RegistryTeamDefinition[] = [];
  const teamIdCounts = new Map<string, number>();

  for (let index = 0; index < values.length; index += 1) {
    const sourceLabel = `definition[${String(index)}]`;
    const result = validateTeamRegistryDefinition(values[index], context, sourceLabel);
    issues.push(...result.issues);

    if (result.valid) {
      const definition = values[index] as RegistryTeamDefinition;
      definitions.push(definition);
      teamIdCounts.set(definition.teamId, (teamIdCounts.get(definition.teamId) ?? 0) + 1);
    }
  }

  const duplicateTeamIds = Array.from(teamIdCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([teamId]) => teamId)
    .sort((left, right) => left.localeCompare(right));

  for (const teamId of duplicateTeamIds) {
    issues.push({
      teamId,
      field: 'teamId',
      code: 'duplicate_team_id',
      message: `Duplicate teamId detected: ${teamId}.`,
    });
  }

  return {
    valid: issues.length === 0,
    definitions: definitions.sort((left, right) => left.teamId.localeCompare(right.teamId)),
    issues: issues.sort((left, right) => {
      const teamCmp = left.teamId.localeCompare(right.teamId);
      if (teamCmp !== 0) {
        return teamCmp;
      }
      const fieldCmp = left.field.localeCompare(right.field);
      if (fieldCmp !== 0) {
        return fieldCmp;
      }
      return left.code.localeCompare(right.code);
    }),
  };
}
