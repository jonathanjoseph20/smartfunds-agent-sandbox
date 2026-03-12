import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { TeamDefinition } from './team-definition-types.ts';
import type { TeamOperatingMode, TeamType } from './team-types.ts';

export interface TeamIdentityPayload {
  displayName: string;
  teamType: TeamType;
  purpose: string;
  domainTags: string[];
  supportedMissionTypes: string[];
  supportedTemplateIds: string[];
  capabilityTags: string[];
  defaultOperatingMode: TeamOperatingMode;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeSemanticStringArray(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((entry) => normalizeText(entry))
        .filter((entry) => entry.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function buildTeamIdentityPayload(definition: TeamDefinition): TeamIdentityPayload {
  return {
    displayName: normalizeText(definition.displayName),
    teamType: definition.teamType,
    purpose: normalizeText(definition.purpose),
    domainTags: normalizeSemanticStringArray(definition.domainTags),
    supportedMissionTypes: normalizeSemanticStringArray(definition.supportedMissionTypes),
    supportedTemplateIds: normalizeSemanticStringArray(definition.supportedTemplateIds),
    capabilityTags: normalizeSemanticStringArray(definition.capabilityTags),
    defaultOperatingMode: definition.defaultOperatingMode,
  };
}

export function deriveTeamIdentityHash(payload: TeamIdentityPayload): string {
  return sha256(canonicalStringify(payload));
}

export function deriveTeamIdentityHashFromDefinition(definition: TeamDefinition): string {
  return deriveTeamIdentityHash(buildTeamIdentityPayload(definition));
}

export function validateExplicitTeamId(teamId: string): void {
  const normalized = teamId.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(`TEAM_INVALID_ID_FORMAT: ${teamId}`);
  }
}
