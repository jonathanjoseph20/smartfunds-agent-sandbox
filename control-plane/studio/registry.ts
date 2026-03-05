import fs from 'node:fs';
import path from 'node:path';

export type Project = {
  projectId: string;
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

function ensureNonEmptyArray(value: unknown, label: string): string[] {
  if (!isStringArray(value) || value.length === 0) {
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
  const wildcardIndex = glob.search(/[\*?[]/);
  if (wildcardIndex === -1) {
    return glob;
  }
  return glob.slice(0, wildcardIndex);
}

function globPotentiallyOverlaps(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  const prefixA = literalPrefix(a);
  const prefixB = literalPrefix(b);
  if (prefixA === '' || prefixB === '') {
    return true;
  }

  if (prefixA.startsWith(prefixB) || prefixB.startsWith(prefixA)) {
    return true;
  }

  return false;
}

function assertNoProjectOverlap(projects: Project[]): void {
  for (let i = 0; i < projects.length; i += 1) {
    for (let j = i + 1; j < projects.length; j += 1) {
      const projectA = projects[i];
      const projectB = projects[j];
      for (const globA of projectA.ownedPaths) {
        for (const globB of projectB.ownedPaths) {
          if (globPotentiallyOverlaps(globA, globB)) {
            const regexA = globToRegExp(globA);
            const regexB = globToRegExp(globB);
            if (regexA.source === regexB.source || regexA.test(globB) || regexB.test(globA)) {
              throw new Error(
                `Project ownedPaths overlap detected between ${projectA.projectId} (${globA}) and ${projectB.projectId} (${globB}).`
              );
            }
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
      if (projectGlob === teamGlob) {
        return true;
      }
      const projectPrefix = literalPrefix(projectGlob);
      const teamPrefix = literalPrefix(teamGlob);
      if (projectPrefix === '' || teamPrefix === '') {
        return true;
      }
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
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir).filter((entry) => entry.endsWith('.json')).sort((a, b) => a.localeCompare(b));
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
    if (!isNonEmptyString(data.id)) {
      throw new Error(`Entity project ${file} must include non-empty id.`);
    }
    if (!isNonEmptyString(data.pod)) {
      throw new Error(`Entity project ${data.id} must include non-empty pod.`);
    }
    const ownedPrefixes = ensureNonEmptyArray(data.ownedPaths, `Entity project ${data.id} ownedPaths`);
    for (const prefix of ownedPrefixes) {
      if (!prefix.endsWith('/')) {
        throw new Error(`Entity project ${data.id} ownedPath ${prefix} must end with '/'.`);
      }
    }

    const project: Project = {
      projectId: data.id,
      podId: data.pod,
      ownedPaths: ownedPrefixes.map(toOwnershipGlobFromPrefix)
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
    if (!isNonEmptyString(data.projectId)) {
      throw new Error(`Project ${file} must include non-empty projectId.`);
    }
    const ownedPaths = ensureNonEmptyArray(data.ownedPaths, `Project ${data.projectId} ownedPaths`);
    const project: Project = {
      projectId: data.projectId,
      ownedPaths: ownedPaths,
      description: isNonEmptyString(data.description) ? data.description : undefined,
      tags: isStringArray(data.tags) ? data.tags : undefined
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

  const hasEntityProjectFiles = fs.existsSync(entitiesProjectsDir) &&
    fs.readdirSync(entitiesProjectsDir).some((entry) => entry.endsWith('.json'));

  if (hasEntityProjectFiles) {
    return loadEntityProjectsFromDir(entitiesProjectsDir);
  }

  return loadProjectsFromDir(fallbackProjectsDir);
}

export function loadTeamsFromDir(dir: string, projects: Project[]): Team[] {
  const projectMap = new Map(projects.map((project) => [project.projectId, project]));

  const loaded = loadJsonFiles<Record<string, unknown>>(dir).map(({ file, data }) => {
    if (!isNonEmptyString(data.teamId)) {
      throw new Error(`Team ${file} must include non-empty teamId.`);
    }
    if (!isNonEmptyString(data.projectId)) {
      throw new Error(`Team ${data.teamId} must include non-empty projectId.`);
    }
    if (!projectMap.has(data.projectId)) {
      throw new Error(`Team ${data.teamId} references unknown projectId ${data.projectId}.`);
    }

    const ownedPaths = ensureNonEmptyArray(data.ownedPaths, `Team ${data.teamId} ownedPaths`);
    const team: Team = {
      teamId: data.teamId,
      projectId: data.projectId,
      ownedPaths: ownedPaths,
      parentTeamId: isNonEmptyString(data.parentTeamId) ? data.parentTeamId : undefined,
      roles: isStringArray(data.roles) ? data.roles : undefined,
      capabilities: isStringArray(data.capabilities) ? data.capabilities : undefined
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
