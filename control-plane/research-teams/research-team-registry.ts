import fs from 'node:fs';
import path from 'node:path';

import {
  ResearchTeamError,
  type ResearchTeam,
  type ResearchTeamAttachmentRules
} from './research-team-types.ts';

export const DEFAULT_RESEARCH_TEAM_DEFINITIONS_DIR = 'control-plane/research-teams/definitions';

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

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => entry !== null);

  if (normalized.length !== value.length) {
    return null;
  }

  return Array.from(new Set(normalized)).sort((left, right) => left.localeCompare(right));
}

function validateAttachmentRules(value: unknown, sourceLabel: string): ResearchTeamAttachmentRules {
  if (!isRecord(value)) {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} attachmentRules must be an object.`);
  }

  const cohortIds = value.cohortIds === undefined ? undefined : asStringArray(value.cohortIds);
  const cohortTypes = value.cohortTypes === undefined ? undefined : asStringArray(value.cohortTypes);
  const subjectFamilies = value.subjectFamilies === undefined ? undefined : asStringArray(value.subjectFamilies);
  const topicCategories = value.topicCategories === undefined ? undefined : asStringArray(value.topicCategories);

  if (value.cohortIds !== undefined && !cohortIds) {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} attachmentRules.cohortIds must be an array of non-empty strings.`);
  }
  if (value.cohortTypes !== undefined && !cohortTypes) {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} attachmentRules.cohortTypes must be an array of non-empty strings.`);
  }
  if (value.subjectFamilies !== undefined && !subjectFamilies) {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} attachmentRules.subjectFamilies must be an array of non-empty strings.`);
  }
  if (value.topicCategories !== undefined && !topicCategories) {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} attachmentRules.topicCategories must be an array of non-empty strings.`);
  }

  if (!cohortIds && !cohortTypes && !subjectFamilies && !topicCategories) {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} attachmentRules must provide at least one rule array.`);
  }

  return {
    ...(cohortIds ? { cohortIds } : {}),
    ...(cohortTypes ? { cohortTypes } : {}),
    ...(subjectFamilies ? { subjectFamilies } : {}),
    ...(topicCategories ? { topicCategories } : {})
  };
}

export function validateResearchTeamDefinition(value: unknown, sourceLabel = '<inline>'): ResearchTeam {
  if (!isRecord(value)) {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} must be an object.`);
  }

  const teamId = asTrimmedString(value.teamId);
  const displayName = asTrimmedString(value.displayName);
  const teamType = asTrimmedString(value.teamType);
  const enabled = value.enabled;
  const attachmentRules = validateAttachmentRules(value.attachmentRules, sourceLabel);

  if (!teamId) {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} teamId must be a non-empty string.`);
  }
  if (!displayName) {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} displayName must be a non-empty string.`);
  }
  if (!teamType) {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} teamType must be a non-empty string.`);
  }
  if (typeof enabled !== 'boolean') {
    throw new ResearchTeamError('RESEARCH_TEAM_INVALID_DEFINITION', `Research team definition ${sourceLabel} enabled must be a boolean.`);
  }

  return {
    teamId,
    displayName,
    teamType,
    enabled,
    attachmentRules
  };
}

export function loadResearchTeamDefinitions(options: { definitionsDir?: string } = {}): ResearchTeam[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_RESEARCH_TEAM_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new ResearchTeamError('RESEARCH_TEAM_DEFINITIONS_NOT_FOUND', `Research team definitions directory not found: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validateResearchTeamDefinition(parsed, entry);
    })
    .sort((left, right) => left.teamId.localeCompare(right.teamId));
}

export function createResearchTeamRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadResearchTeamDefinitions({ definitionsDir: options.definitionsDir });
  const byTeamId = new Map<string, ResearchTeam>();

  for (const definition of definitions) {
    if (byTeamId.has(definition.teamId)) {
      throw new ResearchTeamError('RESEARCH_TEAM_DUPLICATE_DEFINITION', `Duplicate research teamId detected: ${definition.teamId}`);
    }
    byTeamId.set(definition.teamId, definition);
  }

  function getResearchTeam(teamId: string): ResearchTeam {
    const found = byTeamId.get(teamId);
    if (!found) {
      throw new ResearchTeamError('RESEARCH_TEAM_NOT_FOUND', `Research team not found: ${teamId}`);
    }
    return found;
  }

  function listResearchTeams(): ResearchTeam[] {
    return Array.from(byTeamId.values()).sort((left, right) => left.teamId.localeCompare(right.teamId));
  }

  return {
    getResearchTeam,
    listResearchTeams
  };
}

export type ResearchTeamRegistry = ReturnType<typeof createResearchTeamRegistry>;

export function getResearchTeam(teamId: string, options: { definitionsDir?: string } = {}): ResearchTeam {
  return createResearchTeamRegistry(options).getResearchTeam(teamId);
}

export function listResearchTeams(options: { definitionsDir?: string } = {}): ResearchTeam[] {
  return createResearchTeamRegistry(options).listResearchTeams();
}
