import type { TeamRegistry } from '../teams/types';
import { globToRegExp, OWNERSHIP_ALLOWLIST } from './ownership';

export type TeamOwnershipStatus = 'ok' | 'ambiguous_team_ownership' | 'unowned_files';

export type TeamOwnershipResult = {
  teamsTouched: string[];
  teamOwnershipStatus: TeamOwnershipStatus;
  fileToTeamMap: Record<string, string>;
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function matchesAny(regexes: RegExp[], file: string): boolean {
  return regexes.some((regex) => regex.test(file));
}

export function resolveTeamsTouched(
  changedFiles: string[],
  teamRegistry: TeamRegistry
): TeamOwnershipResult {
  const orderedFiles = [...changedFiles].sort((a, b) => a.localeCompare(b));
  const orderedTeams = [...teamRegistry].sort((a, b) => a.teamId.localeCompare(b.teamId));
  const allowlistRegexes = OWNERSHIP_ALLOWLIST.map((glob) => globToRegExp(glob));
  const teamMatchers = orderedTeams.map((team) => ({
    teamId: team.teamId,
    regexes: [...team.ownedPaths].map((glob) => globToRegExp(glob))
  }));

  const teamsTouched = new Set<string>();
  const unownedFiles: string[] = [];
  const ambiguousFiles: string[] = [];
  const fileToTeamMap: Record<string, string> = {};

  for (const file of orderedFiles) {
    if (matchesAny(allowlistRegexes, file)) {
      continue;
    }

    const matchedTeams = teamMatchers
      .filter((matcher) => matchesAny(matcher.regexes, file))
      .map((matcher) => matcher.teamId);

    if (matchedTeams.length === 0) {
      unownedFiles.push(file);
      continue;
    }

    if (matchedTeams.length > 1) {
      ambiguousFiles.push(file);
      continue;
    }

    const teamId = matchedTeams[0];
    teamsTouched.add(teamId);
    fileToTeamMap[file] = teamId;
  }

  const teamOwnershipStatus: TeamOwnershipStatus =
    ambiguousFiles.length > 0
      ? 'ambiguous_team_ownership'
      : unownedFiles.length > 0
        ? 'unowned_files'
        : 'ok';

  return {
    teamsTouched: sortedUnique(Array.from(teamsTouched)),
    teamOwnershipStatus,
    fileToTeamMap
  };
}
