import fs from 'node:fs';
import path from 'node:path';

export type Project = {
  projectId: string;
  // NOTE: ownedPaths holds BOTH globs and exact file paths (we merge ownedFiles into ownedPaths).
  ownedPaths: string[];
  description?: string;
  tags?: string[];
  podId?: string;
};

export type Team = {
  teamId: string;
  projectId: string;
  ownedPaths: string[];
  parentTeamId?: string;
  roles?: string[];
  capabilities?: string[];
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

// Allows [] (used for ownedFiles, and for entity ownedPaths if ownedFiles exist).
function ensureStringArrayOrEmpty(value: unknown): string[] {
  if (value === undefined) return [];
  if (!isStringArray(value)) {
    throw new Error('Expected string array.');
  }
  return value;
}

// Requires at least one element.
function ensureNonEmptyArray(value: unknown, label: string): string[] {
  if (!isStringArray(value) || value.length == 0) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  return value;
}

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
  const wildcardIndex = glob.search(/[\*\?\[]/);
  if (wildcardIndex === -1) return glob;
  return glob.slice(0, wildcardIndex);
}

function globPotentiallyOverlaps(a: string, b: string): boolean {
  if (a === b) return true;

  const prefixA = literalPrefix(a);
  const prefixB = literalPrefix(b);

  if (prefixA === '' || prefixB === '') return true;
  if (prefixA.startsWith(prefixB) || prefixB.startsWith(prefixA)) return true;

  return false;
}

function assertNoProjectOverlap(projects: Project[]): void {
  for (let i = 0; i < projects.length; i += 1) {
    for (let j = i + 1; j < projects.length; j += 1) {
      const projectA = projects[i];
      const projectB = projects[j];
      for (const globA of projectA.ownedPaths) {
        for (const globB of projectB.ownedPaths) {
          if (!globPotentiallyOverlaps(globA, globB)) continue;

          const regexA = globToRegExp(globA);
          const regexB = globToRegExp(globB);

          // If either pattern matches the other string (or identical regex), treat as overlap.
          if (regexA.source === regexB.source || regexA.test(globB) || regexB.test(globA)) {
            throw new Error(
              `Project ownedPaths overlap detected between ${projectA.projectId} (${globA}) and ${projectB.projectId} (${globB}).`
            );
          }
        }
      }
    }
  }
}

function assertTeamSubset(team: Team, project: Project): void {
  for (const teamGlob of team.ownedPaths) {
    const matchesProject = project.ownedPaths.some((projectGlob) => {
      if (projectGlob === teamGlob) return true;

      const projectPrefix = literalPrefix(projectGlob);
      const teamPrefix = literalPrefix(teamGlob);

      if (projectPrefix === '' || teamPrefix === '') return true;
      return teamPrefix.startsWith(projectPrefix);
    });

    if (!matchesProject) {
      throw new Error(
        `Team ${team.teamId} ownedPath ${teamGlob} is outside project ${project.projectId} boundaries.`
      );
    }
  }
}

function loadJsonFiles<T>(dir: string): Array<{ file: string; data: T }> {
  if (!fs.existsSync(dir)) return [];
  const entries = fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  return entries.map((entry) => {
    const filePath = path.join(dir, entry);
    const raw = fs.readFileSync(filePath, 'utf8');
    return { file: entry, data: JSON.parse(raw) as T };
  });
}

function toOwnershipGlobFromPrefix(prefix: string): string {
  return `${prefix}**`;
}

function loadEntityProjectsFromDir(dir: string): Project[] {
  const loaded = loadJsonFiles<Record<string, unknown>>(dir).map(({ file, data }) => {
    if (!isNonEmptyString((data as any).id)) {
      throw new Error(`Entity project ${file} must include non-empty id.`);
    }
    if (!isNonEmptyString((data as any).pod)) {
      throw new Error(`Entity project ${(data as any).id} must include non-empty pod.`);
    }

    const ownedPrefixes = ensureStringArrayOrEmpty((data as any).ownedPaths);
    const ownedFiles = ensureStringArrayOrEmpty((data as any).ownedFiles);

    // Require: at least one of ownedPaths or ownedFiles.
    if (ownedPrefixes.length === 0 && ownedFiles.length === 0) {
      throw new Error(`Entity project ${(data as any).id} must include non-empty ownedPaths or ownedFiles.`);
    }

    for (const prefix of ownedPrefixes) {
      if (!prefix.endsWith('/')) {
        throw new Error(`Entity project ${(data as any).id} ownedPath ${prefix} must end with '/'.`);
      }
    }

    const expandedOwnedPaths = [
      ...ownedPrefixes.map(toOwnershipGlobFromPrefix),
      ...ownedFiles
    ];

    const project: Project = {
      projectId: (data as any).id,
      podId: (data as any).pod,
      ownedPaths: expandedOwnedPaths
    };

    return project;
  });

  const projectIds = loaded.map((project) => project.projectId);
  const idSet = new Set(projectIds);
  if (idSet.size !== projectIds.length) {
    const duplicates = projectIds.filter((id, index) => projectIds.indexOf(id) !== index);
    throw new Error(`Duplicate projectId detected: ${Array.from(new Set(duplicates)).join(', ')}.`);
  }

  const sorted = [...loaded].sort((a, b) => a.projectId.localeCompare(b.projectId));
  assertNoProjectOverlap(sorted);
  return sorted;
}

export function loadProjectsFromDir(dir: string): Project[] {
  const loaded = loadJsonFiles<Record<string, unknown>>(dir).map(({ file, data }) => {
    if (!isNonEmptyString((data as any).projectId)) {
      throw new Error(`Project ${file} must include non-empty projectId.`);
    }

    const ownedPaths = ensureNonEmptyArray((data as any).ownedPaths, `Project ${(data as any).projectId} ownedPaths`);
    const ownedFiles = ensureStringArrayOrEmpty((data as any).ownedFiles);

    const expandedOwnedPaths = [
      ...ownedPaths,
      ...ownedFiles
    ];

    const project: Project = {
      projectId: (data as any).projectId,
      ownedPaths: expandedOwnedPaths,
      description: isNonEmptyString((data as any).description) ? (data as any).description : undefined,
      tags: isStringArray((data as any).tags) ? (data as any).tags : undefined
    };

    return project;
  });

  const projectIds = loaded.map((project) => project.projectId);
  const idSet = new Set(projectIds);
  if (idSet.size !== projectIds.length) {
    const duplicates = projectIds.filter((id, index) => projectIds.indexOf(id) !== index);
    throw new Error(`Duplicate projectId detected: ${Array.from(new Set(duplicates)).join(', ')}.`);
  }

  const sorted = [...loaded].sort((a, b) => a.projectId.localeCompare(b.projectId));
  assertNoProjectOverlap(sorted);
  return sorted;
}

export function loadOwnershipProjects(options: {
  entitiesProjectsDir?: string;
  fallbackProjectsDir?: string;
} = {}): Project[] {
  const entitiesProjectsDir = options.entitiesProjectsDir ?? 'entities/projects';
  const fallbackProjectsDir = options.fallbackProjectsDir ?? 'control-plane/projects';

  const hasEntityProjectFiles =
    fs.existsSync(entitiesProjectsDir) &&
    fs.readdirSync(entitiesProjectsDir).some((entry) => entry.endsWith('.json'));

  if (hasEntityProjectFiles) {
    return loadEntityProjectsFromDir(entitiesProjectsDir);
  }

  return loadProjectsFromDir(fallbackProjectsDir);
}

export function loadTeamsFromDir(dir: string, projects: Project[]): Team[] {
  const projectMap = new Map(projects.map((project) => [project.projectId, project]));

  const loaded = loadJsonFiles<Record<string, unknown>>(dir).map(({ file, data }) => {
    if (!isNonEmptyString((data as any).teamId)) {
      throw new Error(`Team ${file} must include non-empty teamId.`);
    }
    if (!isNonEmptyString((data as any).projectId)) {
      throw new Error(`Team ${(data as any).teamId} must include non-empty projectId.`);
    }
    if (!projectMap.has((data as any).projectId)) {
      throw new Error(`Team ${(data as any).teamId} references unknown projectId ${(data as any).projectId}.`);
    }

    const ownedPaths = ensureNonEmptyArray((data as any).ownedPaths, `Team ${(data as any).teamId} ownedPaths`);
    const ownedFiles = ensureStringArrayOrEmpty((data as any).ownedFiles);

    const expandedOwnedPaths = [
      ...ownedPaths,
      ...ownedFiles
    ];

    const team: Team = {
      teamId: (data as any).teamId,
      projectId: (data as any).projectId,
      ownedPaths: expandedOwnedPaths,
      parentTeamId: isNonEmptyString((data as any).parentTeamId) ? (data as any).parentTeamId : undefined,
      roles: isStringArray((data as any).roles) ? (data as any).roles : undefined,
      capabilities: isStringArray((data as any).capabilities) ? (data as any).capabilities : undefined
    };

    return team;
  });

  const teamIds = loaded.map((team) => team.teamId);
  const idSet = new Set(teamIds);
  if (idSet.size !== teamIds.length) {
    const duplicates = teamIds.filter((id, index) => teamIds.indexOf(id) !== index);
    throw new Error(`Duplicate teamId detected: ${Array.from(new Set(duplicates)).join(', ')}.`);
  }

  const sorted = [...loaded].sort((a, b) => a.teamId.localeCompare(b.teamId));
  const teamMap = new Map(sorted.map((team) => [team.teamId, team]));

  for (const team of sorted) {
    const project = projectMap.get(team.projectId);
    if (!project) {
      throw new Error(`Team ${team.teamId} references unknown projectId ${team.projectId}.`);
    }
    assertTeamSubset(team, project);

    if (team.parentTeamId && !teamMap.has(team.parentTeamId)) {
      throw new Error(`Team ${team.teamId} references unknown parentTeamId ${team.parentTeamId}.`);
    }
  }

  return sorted;
}
