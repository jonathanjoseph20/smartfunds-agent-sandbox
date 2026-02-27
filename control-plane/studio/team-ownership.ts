import { resolveOwnership } from './ownership.ts';
import type { Project, Team } from './registry';

/**
 * Backwards-compatible alias: some callers expect makeOwnership().
 */
export const makeOwnership = resolveOwnership;

/**
 * validate-pr.ts expects resolveTeamsTouched() to exist and return a string[]
 * of teamIds. We derive it from resolveOwnership().
 */
export function resolveTeamsTouched(params: {
  changedFiles: string[];
  projects: Project[];
  teams: Team[];
}): string[] {
  return resolveOwnership(params).teamsTouched;
}

export * from './ownership.ts';
