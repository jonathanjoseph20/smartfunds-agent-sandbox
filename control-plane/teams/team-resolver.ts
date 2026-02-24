import { TEAM_REGISTRY } from './registry.ts';
import type { ExecutionMode, TeamDefinition, TeamResolutionResult } from './types.ts';

type TeamMatch = {
  teamId: string;
  executionMode: ExecutionMode;
  specificity: number;
};

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(glob: string): RegExp {
  const escaped = escapeRegex(glob);
  const pattern = escaped
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');

  return new RegExp(`^${pattern}$`);
}

function literalPrefix(glob: string): string {
  const wildcardIndex = glob.search(/[\*?[]/);
  if (wildcardIndex === -1) {
    return glob;
  }
  return glob.slice(0, wildcardIndex);
}

function sortedUnique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b)) as T[];
}

function getMatchesForFile(file: string, teams: TeamDefinition[]): TeamMatch[] {
  const matches: TeamMatch[] = [];

  for (const team of teams) {
    for (const glob of team.ownedPaths) {
      if (!globToRegExp(glob).test(file)) {
        continue;
      }
      matches.push({
        teamId: team.teamId,
        executionMode: team.executionMode,
        specificity: literalPrefix(glob).length
      });
    }
  }

  return matches.sort((a, b) => {
    if (b.specificity !== a.specificity) {
      return b.specificity - a.specificity;
    }
    return a.teamId.localeCompare(b.teamId);
  });
}

export function resolveTeamsForChangedFiles(
  changedFiles: string[],
  teams: TeamDefinition[] = TEAM_REGISTRY
): TeamResolutionResult {
  const orderedFiles = [...changedFiles].sort((a, b) => a.localeCompare(b));
  const orderedTeams = [...teams].sort((a, b) => a.teamId.localeCompare(b.teamId));

  const teamsTouched = new Set<string>();
  const executionModesTouched = new Set<ExecutionMode>();
  const unownedPaths: string[] = [];
  const ambiguousPaths: string[] = [];

  for (const file of orderedFiles) {
    const matches = getMatchesForFile(file, orderedTeams);
    if (matches.length === 0) {
      unownedPaths.push(file);
      continue;
    }

    const winner = matches[0];
    teamsTouched.add(winner.teamId);
    executionModesTouched.add(winner.executionMode);

    const equallySpecific = matches.filter((match) => match.specificity === winner.specificity);
    if (equallySpecific.length > 1) {
      ambiguousPaths.push(file);
    }
  }

  const modeWarnings: string[] = [];
  const sortedModes = sortedUnique(Array.from(executionModesTouched));
  const sortedUnownedPaths = sortedUnique(unownedPaths);
  const sortedAmbiguousPaths = sortedUnique(ambiguousPaths);

  if (sortedModes.includes('structured') && sortedModes.includes('autonomous')) {
    modeWarnings.push('MIXED_MODE_PR');
  }
  if (sortedUnownedPaths.length > 0) {
    modeWarnings.push('UNOWNED_PATHS');
  }
  if (sortedAmbiguousPaths.length > 0) {
    modeWarnings.push('AMBIGUOUS_OWNERSHIP');
  }

  return {
    teamsTouched: sortedUnique(Array.from(teamsTouched)),
    executionModesTouched: sortedModes,
    unownedPaths: sortedUnownedPaths,
    ambiguousPaths: sortedAmbiguousPaths,
    modeWarnings: sortedUnique(modeWarnings)
  };
}
