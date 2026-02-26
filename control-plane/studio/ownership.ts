import type { Project, Team } from './registry';

export const OWNERSHIP_ALLOWLIST = ['.github/**','docs/**','governance/**'];

export type OwnershipStatus =
  | 'ok'
  | 'multi_project'
  | 'ambiguous_project_ownership'
  | 'unowned_files'
  | 'no_project_detected';

export type OwnershipResult = {
  projectsTouched: string[];
  teamsTouched: string[];
  unownedFiles: string[];
  ownershipStatus: OwnershipStatus;
  nextActions: string[];
};

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function globToRegExp(glob: string): RegExp {
  const escaped = escapeRegex(glob);
  const pattern = escaped
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');

  return new RegExp(`^${pattern}$`);
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function normalizePath(p: string): string {
  return p.replace(/^\.\//, '').replace(/^\/+/, '');
}

export function resolveOwnership(params: {
  changedFiles: string[];
  projects: Project[];
  teams: Team[];
}): OwnershipResult {
  const orderedFiles = sortedUnique(params.changedFiles.map(normalizePath));
  const orderedProjects = [...params.projects].sort((a, b) =>
    a.projectId.localeCompare(b.projectId)
  );
  const orderedTeams = [...params.teams].sort((a, b) =>
    a.teamId.localeCompare(b.teamId)
  );

  const allowlistRegexes = OWNERSHIP_ALLOWLIST.map(globToRegExp);

  const projectMatchers = orderedProjects.map((project) => ({
    project,
    regexes: project.ownedPaths.map(globToRegExp),
  }));

  const projectsTouched = new Set<string>();
  const unownedFiles: string[] = [];
  let hasAmbiguous = false;

  for (const file of orderedFiles) {
    if (allowlistRegexes.some((regex) => regex.test(file))) {
      continue;
    }

    const matchedProjects = projectMatchers
      .filter((matcher) =>
        matcher.regexes.some((regex) => regex.test(file))
      )
      .map((matcher) => matcher.project.projectId);

    if (matchedProjects.length === 1) {
      projectsTouched.add(matchedProjects[0]);
      continue;
    }

    if (matchedProjects.length > 1) {
      hasAmbiguous = true;
      continue;
    }

    unownedFiles.push(file);
  }

  let ownershipStatus: OwnershipStatus;

  if (hasAmbiguous) {
    ownershipStatus = 'ambiguous_project_ownership';
  } else if (projectsTouched.size > 1) {
    ownershipStatus = 'multi_project';
  } else if (unownedFiles.length > 0) {
    ownershipStatus = 'unowned_files';
  } else if (projectsTouched.size === 0) {
    ownershipStatus = 'no_project_detected';
  } else {
    ownershipStatus = 'ok';
  }

  const resolvedProject =
    projectsTouched.size === 1
      ? Array.from(projectsTouched)[0]
      : null;

  const teamsTouched = new Set<string>();

  if (resolvedProject) {
    const relevantTeams = orderedTeams.filter(
      (team) => team.projectId === resolvedProject
    );

    for (const file of orderedFiles) {
      if (allowlistRegexes.some((regex) => regex.test(file))) {
        continue;
      }

      for (const team of relevantTeams) {
        if (
          team.ownedPaths.some((glob) =>
            globToRegExp(glob).test(file)
          )
        ) {
          teamsTouched.add(team.teamId);
        }
      }
    }
  }

  return {
    projectsTouched: sortedUnique(Array.from(projectsTouched)),
    teamsTouched: sortedUnique(Array.from(teamsTouched)),
    unownedFiles: sortedUnique(unownedFiles),
    ownershipStatus,
    nextActions: [],
  };
}

export function buildOwnershipErrors(result: OwnershipResult): string[] {
  const status = result.ownershipStatus;

  if (status === 'ok') return [];

  if (status === 'no_project_detected') {
    return ['Ownership violation: no project detected for changed files.'];
  }

  if (status === 'unowned_files') {
    const files = (result.unownedFiles ?? []).slice().sort();
    return [
      files.length
        ? `Ownership violation: unowned files detected: ${files.join(', ')}`
        : 'Ownership violation: unowned files detected.'
    ];
  }

  if (status === 'ambiguous_project_ownership') {
    return ['Ownership violation: ambiguous project ownership (multiple projects match changed files).'];
  }

  if (status === 'multi_project') {
    const projects = (result.projectsTouched ?? []).slice().sort();
    return [
      projects.length
        ? `Ownership violation: multiple projects touched: ${projects.join(', ')}`
        : 'Ownership violation: multiple projects touched.'
    ];
  }

  // Fallback (shouldn’t happen)
  return [`Ownership violation: ${String(status)}`];
}
