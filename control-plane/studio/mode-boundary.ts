import type { ExecutionMode, TeamRegistry } from '../teams/types';

export type ModeBoundaryStatus = 'ok' | 'multi_mode_conflict';

export type ModeBoundaryResult = {
  modeBoundaryStatus: ModeBoundaryStatus;
  conflictingTeams?: string[];
  conflictingPaths?: string[];
  nextActions?: string[];
};

function sortedUnique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b)) as T[];
}

export function computeExecutionModesTouched(
  teamsTouched: string[],
  teamRegistry: TeamRegistry
): ExecutionMode[] {
  const teamMap = new Map(teamRegistry.map((team) => [team.teamId, team.executionMode]));
  const modes: ExecutionMode[] = [];

  for (const teamId of teamsTouched) {
    const mode = teamMap.get(teamId);
    if (!mode) {
      throw new Error(`Unknown teamId in mode boundary computation: ${teamId}.`);
    }
    modes.push(mode);
  }

  return sortedUnique(modes);
}

export function enforceModeBoundary(
  executionModesTouched: ExecutionMode[],
  teamsTouched: string[],
  changedFiles: string[]
): ModeBoundaryResult {
  if (executionModesTouched.length <= 1) {
    return { modeBoundaryStatus: 'ok' };
  }

  return {
    modeBoundaryStatus: 'multi_mode_conflict',
    conflictingTeams: sortedUnique(teamsTouched),
    conflictingPaths: sortedUnique(changedFiles),
    nextActions: [
      'Split PR into separate mode-specific changes.',
      'Ensure each PR touches only structured OR only autonomous teams.'
    ]
  };
}
