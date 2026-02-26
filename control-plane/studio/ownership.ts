import type { Project, Team } from './registry';

const ALLOWLIST = ['.github/**'];

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

function globToRegExp(glob: string): RegExp {
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

function buildNextActions(status: OwnershipStatus): string[] {
  switch (status) {
    case 'multi_project':
      return [
        'Ensure all changed paths belong to a single registered project.',
        'Split changes by project or update project ownership definitions.'
      ];
    case 'ambiguous_project_ownership':
      return [
        'Resolve overlapping project ownership definitions in control-plane/projects/*.json.',
        'Ensure each path maps to exactly one project.'
      ];
    case 'unowned_files':
      return [
        'Ensure every changed path is owned by a registered project.',
        'Update control-plane/projects/*.json if a new project is intended.'
      ];
    case 'no_project_detected':
      return [
        'Ensure at least one changed path belongs to a registered project.',
        'Update control-plane/projects/*.json if a new project is intended.'
      ];
    default:
      return [];
  }
}

export function buildOwnershipErrors(result: OwnershipResult): string[] {
  switch (result.ownershipStatus) {
    case 'multi_project':
      return ['Ownership violation: changes span multiple projects.'];
    case 'ambiguous_project_ownership':
      return ['Ownership violation: ambiguous project ownership detected.'];
    case 'unowned_files':
      return ['Ownership violation: unowned files detected.'];
    case 'no_project_detected':
      return ['Ownership violation: no project detected for changed files.'];
    default:
      return [];
  }
}

function buildOwnershipStatus(
  hasAmbiguous: boolean,
  projectsTouched: Set<string>,
  unownedFiles: string[]
): OwnershipStatus {
  if (hasAmbiguous) {
    return 'ambiguous_project_ownership';
  }

  if (projectsTouched.size === 0) {
    return 'no_project_detected';
  }

  if (projectsTouched.size > 1) {
    return 'multi_project';
  }

  if (unownedFiles.length > 0) {
    return 'unowned_files';
  }

  return 'ok';
}

function matchAny(globs: string[], file: string): boolean {
  for (const glob of globs) {
    if (globToRegExp(glob).test(file)) {
      return true;
    }
  }
  return false;
}

export function resolveOwnership(params: {
  changedFiles: string[];
  projects: Project[];
  teams: Team[];
}): OwnershipResult {
  const orderedFiles = [...params.changedFiles].sort((a, b) => a.localeCompare(b));
  const orderedProjects = [...params.projects].sort((a, b) => a.projectId.localeCompare(b.projectId));
  const orderedTeams = [...params.teams].sort((a, b) => a.teamId.localeCompare(b.teamId));
  const projectMatchers = orderedProjects.map((project) => ({
    project,
    regexes: project.ownedPaths.map((glob) => globToRegExp(glob))
  }));

  const allowlistRegexes = ALLOWLIST.map((glob) => globToRegExp(glob));
  const projectsTouched = new Set<string>();
  const unownedFiles: string[] = [];
  let hasAmbiguous = false;

  for (const file of orderedFiles) {
    if (allowlistRegexes.some((regex) => regex.test(file))) {
      continue;
    }

    const matchedProjects = projectMatchers
      .filter((matcher) => matcher.regexes.some((regex) => regex.test(file)))
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

  const ownershipStatus = buildOwnershipStatus(hasAmbiguous, projectsTouched, unownedFiles);
  const resolvedProject = projectsTouched.size === 1 ? Array.from(projectsTouched)[0] : null;

  const teamsTouched = new Set<string>();
  if (resolvedProject) {
    const relevantTeams = orderedTeams.filter((team) => team.projectId === resolvedProject);
    for (const file of orderedFiles) {
      if (allowlistRegexes.some((regex) => regex.test(file))) {
        continue;
      }
      for (const team of relevantTeams) {
        if (matchAny(team.ownedPaths, file)) {
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
    nextActions: buildNextActions(ownershipStatus)
  };
}
