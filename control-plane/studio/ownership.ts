import type { Project, Team } from './registry';

export const OWNERSHIP_ALLOWLIST = ['.github/**', 'docs/**', 'governance/**'];

export type OwnershipStatus =
  | 'ok'
  | 'multi_project'
  | 'ambiguous_project_ownership'
  | 'unowned_files'
  | 'no_project_detected';

export type OwnershipConflictDetail = {
  file: string;
  matches: Array<{ projectId: string; patterns: string[] }>;
};

export type UnownedFileDetail = {
  file: string;
  candidateProjectId: string | null;
  reason: string;
  suggestedFix: string | null;
};

export type OwnershipResult = {
  projectsTouched: string[];
  teamsTouched: string[];
  unownedFiles: string[];
  ownershipStatus: OwnershipStatus;
  nextActions: string[];
  ambiguousOwnership: OwnershipConflictDetail[];
  unownedDetails: UnownedFileDetail[];
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

function inferCandidateProject(file: string, projects: Project[]): string | null {
  const topLevel = file.split('/')[0] ?? file;
  const direct = projects.find((project) => project.projectId === topLevel);
  if (direct) {
    return direct.projectId;
  }

  const byPrefix = projects.find((project) =>
    (project.ownedPathPrefixes ?? []).some((prefix) => prefix === `${topLevel}/`)
  );
  if (byPrefix) {
    return byPrefix.projectId;
  }

  return null;
}

function parentDirectoryPrefix(file: string): string {
  const slash = file.lastIndexOf('/');
  if (slash <= 0) {
    return '';
  }
  return `${file.slice(0, slash + 1)}`;
}

function buildUnownedDetail(file: string, projects: Project[]): UnownedFileDetail {
  const candidateProjectId = inferCandidateProject(file, projects);
  const parentPrefix = parentDirectoryPrefix(file);

  if (candidateProjectId && parentPrefix) {
    return {
      file,
      candidateProjectId,
      reason: `no ownedPaths entry covers "${parentPrefix}"`,
      suggestedFix: `add "${parentPrefix}" to entities/projects/${candidateProjectId}.json`
    };
  }

  return {
    file,
    candidateProjectId,
    reason: 'no ownedPaths or ownedFiles entry matched this path',
    suggestedFix: null
  };
}

export function resolveOwnership(params: {
  changedFiles: string[];
  projects: Project[];
  teams: Team[];
}): OwnershipResult {
  const orderedFiles = sortedUnique((params.changedFiles ?? []).map(normalizePath));
  const orderedProjects = [...(params.projects ?? [])].sort((a, b) =>
    a.projectId.localeCompare(b.projectId)
  );
  const orderedTeams = [...(params.teams ?? [])].sort((a, b) =>
    a.teamId.localeCompare(b.teamId)
  );

  const allowlistRegexes = OWNERSHIP_ALLOWLIST.map(globToRegExp);

  const projectMatchers = orderedProjects.map((project) => ({
    project,
    pathRules: project.ownedPaths
      .map((pattern) => ({ pattern, regex: globToRegExp(pattern) }))
      .sort((a, b) => a.pattern.localeCompare(b.pattern)),
    exactFiles: sortedUnique(project.ownedFilePaths ?? [])
  }));

  const projectsTouched = new Set<string>();
  const unownedFiles: string[] = [];
  const ambiguousOwnership: OwnershipConflictDetail[] = [];
  const unownedDetails: UnownedFileDetail[] = [];
  let hasAmbiguous = false;
  let hasNonAllowlistedFile = false;

  for (const file of orderedFiles) {
    if (allowlistRegexes.some((regex) => regex.test(file))) {
      continue;
    }
    hasNonAllowlistedFile = true;

    const matchedProjects = projectMatchers
      .map((matcher) => {
        const matchedPatterns = matcher.pathRules
          .filter((rule) => rule.regex.test(file))
          .map((rule) => rule.pattern);

        const matchedExactFiles = matcher.exactFiles.filter((ownedFile) => ownedFile === file);

        return {
          projectId: matcher.project.projectId,
          patterns: [...matchedPatterns, ...matchedExactFiles].sort((a, b) => a.localeCompare(b))
        };
      })
      .filter((match) => match.patterns.length > 0)
      .sort((a, b) => a.projectId.localeCompare(b.projectId));

    if (matchedProjects.length === 1) {
      projectsTouched.add(matchedProjects[0].projectId);
      continue;
    }

    if (matchedProjects.length > 1) {
      hasAmbiguous = true;
      ambiguousOwnership.push({
        file,
        matches: matchedProjects
      });
      continue;
    }

    unownedFiles.push(file);
    unownedDetails.push(buildUnownedDetail(file, orderedProjects));
  }

  let ownershipStatus: OwnershipStatus;

  if (hasAmbiguous) {
    ownershipStatus = 'ambiguous_project_ownership';
  } else if (projectsTouched.size > 1) {
    ownershipStatus = 'multi_project';
  } else if (unownedFiles.length > 0) {
    ownershipStatus = 'unowned_files';
  } else if (projectsTouched.size === 0 && !hasNonAllowlistedFile) {
    ownershipStatus = 'ok';
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
    ambiguousOwnership: ambiguousOwnership
      .map((detail) => ({
        file: detail.file,
        matches: detail.matches.map((match) => ({
          projectId: match.projectId,
          patterns: sortedUnique(match.patterns)
        }))
      }))
      .sort((a, b) => a.file.localeCompare(b.file)),
    unownedDetails: unownedDetails
      .map((detail) => ({
        file: detail.file,
        candidateProjectId: detail.candidateProjectId,
        reason: detail.reason,
        suggestedFix: detail.suggestedFix
      }))
      .sort((a, b) => a.file.localeCompare(b.file))
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
    const details = (result.unownedDetails ?? []).slice().sort((a, b) => a.file.localeCompare(b.file));
    const lines = [
      files.length
        ? `Ownership violation: unowned files detected: ${files.join(', ')}`
        : 'Ownership violation: unowned files detected.'
    ];

    for (const detail of details) {
      lines.push(`Unowned file: ${detail.file}`);
      if (detail.candidateProjectId) {
        lines.push(`Candidate project: ${detail.candidateProjectId}`);
      }
      lines.push(`Reason: ${detail.reason}`);
      if (detail.suggestedFix) {
        lines.push(`Suggested fix: ${detail.suggestedFix}`);
      }
    }

    return lines;
  }

  if (status === 'ambiguous_project_ownership') {
    const details = (result.ambiguousOwnership ?? []).slice().sort((a, b) => a.file.localeCompare(b.file));
    const lines = ['Ownership violation: ambiguous project ownership (multiple projects match changed files).'];

    for (const detail of details) {
      const matchText = detail.matches
        .map((match) => `${match.projectId} [${match.patterns.join(', ')}]`)
        .join('; ');
      lines.push(`Conflicting ownership for ${detail.file}: ${matchText}`);
    }

    return lines;
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
