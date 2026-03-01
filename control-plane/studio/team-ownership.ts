import { minimatch } from 'minimatch';
import type { TeamRegistry } from '../teams/types';

export type TeamOwnershipStatus = 'ok' | 'ambiguous_team_ownership' | 'unowned_files';

export type TeamsTouchedResult = {
  teamOwnershipStatus: TeamOwnershipStatus;
  teamsTouched: string[];
  fileToTeamMap: Record<string, string>;
};

function isAllowlisted(file: string): boolean {
  // Keep this minimal and deterministic. Extend later as needed.
  // Current tests expect .github/workflows/ci.yml to be allowlisted.
  return minimatch(file, '.github/**', { dot: true });
}

function matchTeamIdsForFile(file: string, registry: TeamRegistry): string[] {
  return registry
    .filter((t) => (t.ownedPaths ?? []).some((p) => minimatch(file, p, { dot: true })))
    .map((t) => t.teamId)
    .sort();
}

/**
 * Primary API expected by tests: returns status + teamsTouched + fileToTeamMap
 */
export function resolveTeamsTouched(changedFiles: string[], registry: TeamRegistry): TeamsTouchedResult {
  const relevantFiles = (changedFiles ?? []).filter((f) => !isAllowlisted(f));

  // If only allowlisted files changed, that's ok and touches no teams.
  if (relevantFiles.length === 0) {
    return { teamOwnershipStatus: 'ok', teamsTouched: [], fileToTeamMap: {} };
  }

  const fileToTeamMap: Record<string, string> = {};
  const touched = new Set<string>();

  let hasAmbiguous = false;
  let hasUnowned = false;

  for (const file of relevantFiles) {
    const matches = matchTeamIdsForFile(file, registry);

    if (matches.length === 0) {
      hasUnowned = true;
      continue;
    }

    if (matches.length > 1) {
      hasAmbiguous = true;
      continue;
    }

    const teamId = matches[0];
    fileToTeamMap[file] = teamId;
    touched.add(teamId);
  }

  if (hasAmbiguous) {
    return { teamOwnershipStatus: 'ambiguous_team_ownership', teamsTouched: [], fileToTeamMap: {} };
  }

  if (hasUnowned) {
    return { teamOwnershipStatus: 'unowned_files', teamsTouched: [], fileToTeamMap: {} };
  }

  return {
    teamOwnershipStatus: 'ok',
    teamsTouched: Array.from(touched).sort(),
    fileToTeamMap,
  };
}

/**
 * Helper API for callers that only want ids.
 * This is useful for validate-pr.ts wiring, but does NOT replace resolveTeamsTouched().
 */
export function resolveTeamsTouchedIds(changedFiles: string[], registry: TeamRegistry): string[] {
  return resolveTeamsTouched(changedFiles, registry).teamsTouched;
}

/**
 * Back-compat alias (some callers may have used makeOwnership in the past).
 */
export const makeOwnership = resolveTeamsTouched;
