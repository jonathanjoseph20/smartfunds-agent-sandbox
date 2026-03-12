import fs from 'node:fs';
import path from 'node:path';

import type { TeamDefinition, TeamValidationIssue } from './team-definition-types.ts';
import {
  buildTeamValidatorReferenceContext,
  validateTeamRegistryDefinition,
} from './team-validator.ts';

export const DEFAULT_TEAM_DEFINITIONS_DIR = 'control-plane/teams/definitions';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function normalizeDefinition(definition: TeamDefinition): TeamDefinition {
  return {
    ...definition,
    teamId: definition.teamId.trim(),
    displayName: definition.displayName.trim(),
    description: definition.description.trim(),
    purpose: definition.purpose.trim(),
    domainTags: sortedUnique(definition.domainTags),
    supportedMissionTypes: sortedUnique(definition.supportedMissionTypes),
    supportedTemplateIds: sortedUnique(definition.supportedTemplateIds),
    capabilityTags: sortedUnique(definition.capabilityTags),
    rosterPolicy: {
      ...definition.rosterPolicy,
      requiredCapabilities: sortedUnique(definition.rosterPolicy.requiredCapabilities),
    },
    notes: sortedUnique(definition.notes),
  };
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function isTeamRegistryDefinitionCandidate(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.teamType === 'string' || typeof record.displayName === 'string';
}

export interface LoadedTeamDefinition {
  fileName: string;
  definition: TeamDefinition;
}

export function loadTeams(options: { definitionsDir?: string } = {}): TeamDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_TEAM_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new Error(`TEAM_DEFINITIONS_NOT_FOUND: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  const context = buildTeamValidatorReferenceContext();
  const definitions: TeamDefinition[] = [];
  const issues: TeamValidationIssue[] = [];

  for (const fileName of files) {
    const parsed = readJson(path.join(definitionsDir, fileName));
    if (!isTeamRegistryDefinitionCandidate(parsed)) {
      continue;
    }

    const result = validateTeamRegistryDefinition(parsed, context, fileName);
    if (!result.valid) {
      issues.push(...result.issues);
      continue;
    }

    definitions.push(normalizeDefinition(parsed as TeamDefinition));
  }

  if (issues.length > 0) {
    const first = issues
      .sort((left, right) => {
        const teamCmp = left.teamId.localeCompare(right.teamId);
        if (teamCmp !== 0) {
          return teamCmp;
        }
        const fieldCmp = left.field.localeCompare(right.field);
        if (fieldCmp !== 0) {
          return fieldCmp;
        }
        return left.code.localeCompare(right.code);
      })[0];

    throw new Error(`TEAM_INVALID_DEFINITION: ${first.teamId}:${first.field}:${first.code}`);
  }

  const seen = new Set<string>();
  for (const definition of definitions) {
    if (seen.has(definition.teamId)) {
      throw new Error(`TEAM_DUPLICATE_ID: ${definition.teamId}`);
    }
    seen.add(definition.teamId);
  }

  return definitions.sort((left, right) => left.teamId.localeCompare(right.teamId));
}

export function createTeamRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadTeams(options);
  const byId = new Map(definitions.map((definition) => [definition.teamId, definition]));

  function listTeams(): TeamDefinition[] {
    return Array.from(byId.values()).sort((left, right) => left.teamId.localeCompare(right.teamId));
  }

  function getTeam(teamId: string): TeamDefinition {
    const found = byId.get(teamId);
    if (!found) {
      throw new Error(`TEAM_NOT_FOUND: ${teamId}`);
    }
    return found;
  }

  return {
    listTeams,
    getTeam,
  };
}

export type TeamRegistry = ReturnType<typeof createTeamRegistry>;
