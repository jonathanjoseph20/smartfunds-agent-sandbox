import type { SwarmMode } from './schema.ts';

export type ParsedSwarmMetadata = {
  swarmsDeclared: string[];
  swarmMode: SwarmMode | null;
  swarmTeamId: string | null;
  hasSwarmModeField: boolean;
  hasSwarmTeamField: boolean;
  swarmWarnings: string[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function parseEvidenceLines(body: string): string[] {
  const match = body.match(/```evidence\s*([\s\S]*?)```/i);
  if (!match) {
    return [];
  }

  return match[1].split('\n');
}

function normalizeMode(value: string): SwarmMode | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'structured' || normalized === 'autonomous') {
    return normalized;
  }
  return null;
}

export function parseSwarmEvidenceMetadata(body: string): ParsedSwarmMetadata {
  const lines = parseEvidenceLines(body);
  const swarmsDeclaredRaw: string[] = [];
  let swarmModeRaw: string | null = null;
  let swarmTeamRaw: string | null = null;
  let hasSwarmModeField = false;
  let hasSwarmTeamField = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const separator = trimmed.indexOf(':');
    if (separator < 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    if (key === 'Swarm' && value) {
      swarmsDeclaredRaw.push(value);
      continue;
    }

    if (key === 'Swarm Mode') {
      hasSwarmModeField = true;
      swarmModeRaw = value;
      continue;
    }

    if (key === 'Swarm Team') {
      hasSwarmTeamField = true;
      swarmTeamRaw = value;
    }
  }

  const swarmsDeclared = sortedUnique(swarmsDeclaredRaw);
  const swarmWarnings: string[] = [];
  let swarmMode: SwarmMode | null = null;

  if (swarmModeRaw !== null) {
    swarmMode = normalizeMode(swarmModeRaw);
    if (swarmMode === null) {
      swarmWarnings.push('invalid_swarm_mode');
    }
  }

  return {
    swarmsDeclared,
    swarmMode,
    swarmTeamId: swarmTeamRaw && swarmTeamRaw.length > 0 ? swarmTeamRaw : null,
    hasSwarmModeField,
    hasSwarmTeamField,
    swarmWarnings: sortedUnique(swarmWarnings)
  };
}
