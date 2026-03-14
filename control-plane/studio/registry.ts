import fs from 'node:fs';
import path from 'node:path';

const CANONICAL_PROJECT_MODES = ['explore', 'structured', 'regulated'] as const;

type CanonicalProjectMode = (typeof CANONICAL_PROJECT_MODES)[number];

export type Project = {
  projectId: string;
  // NOTE: ownedPaths holds BOTH globs and exact file paths (we merge ownedFiles into ownedPaths).
  ownedPaths: string[];
  description?: string;
  tags?: string[];
  podId?: string;
  entityId?: string;
  mode?: CanonicalProjectMode;
  ownedPathPrefixes?: string[];
  ownedFilePaths?: string[];
  sourceFile?: string;
};

export type Team = {
  teamId: string;
  projectId: string;
  ownedPaths: string[];
  ownedFilePaths?: string[];
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

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function assertKebabCase(value: string, label: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`${label} must be kebab-case.`);
  }
}

function assertCanonicalMode(value: unknown, label: string): asserts value is CanonicalProjectMode {
  if (!CANONICAL_PROJECT_MODES.includes(value as CanonicalProjectMode)) {
    throw new Error(`${label} must be one of ${CANONICAL_PROJECT_MODES.join(', ')}.`);
  }
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (!isStringArray(value)) {
    throw new Error(`${label} must be a string array of non-empty strings.`);
  }
  return value;
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

function loadKnownEntityIds(registryPath: string): Set<string> {
  if (!fs.existsSync(registryPath)) {
    return new Set<string>();
  }

  const raw = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(`Entity registry ${registryPath} must be an array.`);
  }

  const ids = raw.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Entity registry ${registryPath} entry ${index} must be an object.`);
    }
    const entityId = (entry as Record<string, unknown>).entityId;
    if (!isNonEmptyString(entityId)) {
      throw new Error(`Entity registry ${registryPath} entry ${index} must include non-empty entityId.`);
    }
    return entityId;
  });

  return new Set(sortedUnique(ids));
}

function loadKnownPodIds(podsDir: string): Set<string> {
  if (!fs.existsSync(podsDir)) {
    return new Set<string>();
  }

  const pods = loadJsonFiles<Record<string, unknown>>(podsDir);
  const podIds = pods.map(({ file, data }) => {
    if (!isNonEmptyString(data.id)) {
      throw new Error(`Pod ${file} must include non-empty id.`);
    }
    return data.id;
  });

  return new Set(sortedUnique(podIds));
}

function canonicalOwnershipEntries(project: Project): Array<{ kind: 'path' | 'file'; pattern: string }> {
  const prefixes = sortedUnique(project.ownedPathPrefixes ?? []);
  const files = sortedUnique(project.ownedFilePaths ?? []);

  return [
    ...prefixes.map((prefix) => ({ kind: 'path' as const, pattern: toOwnershipGlobFromPrefix(prefix) })),
    ...files.map((file) => ({ kind: 'file' as const, pattern: file }))
  ];
}

function ownershipEntriesOverlap(
  left: { kind: 'path' | 'file'; pattern: string },
  right: { kind: 'path' | 'file'; pattern: string }
): boolean {
  if (left.kind === 'file' && right.kind === 'file') {
    return left.pattern === right.pattern;
  }

  if (left.kind === 'path' && right.kind === 'path') {
    const leftPrefix = left.pattern.slice(0, -2);
    const rightPrefix = right.pattern.slice(0, -2);
    return leftPrefix.startsWith(rightPrefix) || rightPrefix.startsWith(leftPrefix);
  }

  const pathEntry = left.kind === 'path' ? left : right;
  const fileEntry = left.kind === 'file' ? left : right;
  const pathPrefix = pathEntry.pattern.slice(0, -2);
  return fileEntry.pattern.startsWith(pathPrefix);
}

function assertNoCanonicalOwnershipOverlap(projects: Project[]): void {
  const ordered = [...projects].sort((a, b) => a.projectId.localeCompare(b.projectId));

  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const projectA = ordered[i];
      const projectB = ordered[j];
      const ownershipA = canonicalOwnershipEntries(projectA);
      const ownershipB = canonicalOwnershipEntries(projectB);

      for (const entryA of ownershipA) {
        for (const entryB of ownershipB) {
          if (!ownershipEntriesOverlap(entryA, entryB)) {
            continue;
          }

          throw new Error(
            `Project ownership overlap detected between ${projectA.projectId} (${entryA.pattern}) and ${projectB.projectId} (${entryB.pattern}).`
          );
        }
      }
    }
  }
}

function loadEntityProjectsFromDir(dir: string, options: {
  entityRegistryPath?: string;
  podsDir?: string;
} = {}): Project[] {
  const entityRegistryPath = options.entityRegistryPath ?? path.resolve('control-plane/entities/registry.json');
  const podsDir = options.podsDir ?? path.resolve('entities/pods');

  const knownEntityIds = loadKnownEntityIds(entityRegistryPath);
  const knownPodIds = loadKnownPodIds(podsDir);

  const loaded = loadJsonFiles<Record<string, unknown>>(dir).filter(({ file }) => file !== 'registry.json').map(({ file, data }) => {
    if (!isNonEmptyString(data.id)) {
      throw new Error(`Entity project ${file} must include non-empty id.`);
    }
    assertKebabCase(data.id, `Entity project ${data.id} id`);

    if (!isNonEmptyString(data.name)) {
      throw new Error(`Entity project ${data.id} must include non-empty name.`);
    }

    if (!isNonEmptyString(data.entity)) {
      throw new Error(`Entity project ${data.id} must include non-empty entity.`);
    }

    if (!isNonEmptyString(data.pod)) {
      throw new Error(`Entity project ${data.id} must include non-empty pod.`);
    }

    assertCanonicalMode(data.mode, `Entity project ${data.id} mode`);

    const ownedPrefixes = ensureStringArray(data.ownedPaths, `Entity project ${data.id} ownedPaths`);
    const ownedFiles = ensureStringArray(data.ownedFiles, `Entity project ${data.id} ownedFiles`);

    if (ownedPrefixes.length === 0 && ownedFiles.length === 0) {
      throw new Error(`Entity project ${data.id} must include at least one ownedPaths or ownedFiles entry.`);
    }

    for (const prefix of ownedPrefixes) {
      if (!prefix.endsWith('/')) {
        throw new Error(`Entity project ${data.id} ownedPath ${prefix} must end with '/'.`);
      }
    }

    if (knownEntityIds.size > 0 && !knownEntityIds.has(data.entity)) {
      throw new Error(
        `Entity project ${data.id} references unknown entity ${data.entity}. Add it to control-plane/entities/registry.json.`
      );
    }

    if (knownPodIds.size > 0 && !knownPodIds.has(data.pod)) {
      throw new Error(`Entity project ${data.id} references unknown pod ${data.pod}. Add it under entities/pods/.`);
    }

    const normalizedPrefixes = sortedUnique(ownedPrefixes);
    const normalizedFiles = sortedUnique(ownedFiles);
    const expandedOwnedPaths = [
      ...normalizedPrefixes.map(toOwnershipGlobFromPrefix),
      ...normalizedFiles
    ];

    const project: Project = {
      projectId: data.id,
      podId: data.pod,
      entityId: data.entity,
      mode: data.mode,
      ownedPathPrefixes: normalizedPrefixes,
      ownedFilePaths: normalizedFiles,
      ownedPaths: expandedOwnedPaths,
      sourceFile: path.join(dir, file)
    };

    return project;
  });

  const projectIds = loaded.map((project) => project.projectId);
  const idSet = new Set(projectIds);
  if (idSet.size !== projectIds.length) {
    const duplicates = projectIds.filter((id, index) => projectIds.indexOf(id) !== index);
    throw new Error(`Duplicate projectId detected: ${Array.from(new Set(duplicates)).sort((a, b) => a.localeCompare(b)).join(', ')}.`);
  }

  const sorted = [...loaded].sort((a, b) => a.projectId.localeCompare(b.projectId));
  assertNoCanonicalOwnershipOverlap(sorted);
  return sorted;
}

export function loadProjectsFromDir(dir: string): Project[] {
  const loaded = loadJsonFiles<Record<string, unknown>>(dir).filter(({ file }) => file !== 'registry.json').map(({ file, data }) => {
    if (!isNonEmptyString((data as any).projectId)) {
      throw new Error(`Project ${file} must include non-empty projectId.`);
    }

    const ownedPaths = ensureNonEmptyArray((data as any).ownedPaths, `Project ${(data as any).projectId} ownedPaths`);
    const ownedFiles = ensureStringArrayOrEmpty((data as any).ownedFiles);

    const expandedOwnedPaths = [...ownedPaths];

    const project: Project = {
      projectId: (data as any).projectId,
      ownedPaths: expandedOwnedPaths,
      description: isNonEmptyString((data as any).description) ? (data as any).description : undefined,
      tags: isStringArray((data as any).tags) ? (data as any).tags : undefined,
      entityId: isNonEmptyString((data as any).entityId) ? (data as any).entityId : undefined,
      ownedPathPrefixes: undefined,
      ownedFilePaths: ownedFiles,
      sourceFile: path.join(dir, file)
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
  allowLegacyFallback?: boolean;
  entityRegistryPath?: string;
  podsDir?: string;
} = {}): Project[] {
  const entitiesProjectsDir = options.entitiesProjectsDir ?? 'entities/projects';
  const fallbackProjectsDir = options.fallbackProjectsDir ?? 'control-plane/projects';

  const hasEntityProjectFiles =
    fs.existsSync(entitiesProjectsDir) &&
    fs.readdirSync(entitiesProjectsDir).some((entry) => entry.endsWith('.json'));

  if (hasEntityProjectFiles) {
    return loadEntityProjectsFromDir(entitiesProjectsDir, {
      entityRegistryPath: options.entityRegistryPath,
      podsDir: options.podsDir
    });
  }

  // Legacy fallback is compatibility-only for non-governance consumers.
  // Governance ownership must use canonical entities/projects/*.json.
  if (options.allowLegacyFallback === true) {
    return loadProjectsFromDir(fallbackProjectsDir);
  }

  throw new Error(`No canonical project specs found in ${entitiesProjectsDir}. Governance requires entities/projects/*.json.`);
}

export function loadTeamsFromDir(dir: string, projects: Project[]): Team[] {
  const projectMap = new Map(projects.map((project) => [project.projectId, project]));

    const loaded = loadJsonFiles<Record<string, unknown>>(dir)
      .filter(({ file }) => file !== 'registry.json')
      .map(({ file, data }) => {
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

      const expandedOwnedPaths = [...ownedPaths];      

      const team: Team = {
        teamId: (data as any).teamId,
        projectId: (data as any).projectId,
        ownedPaths: expandedOwnedPaths,
        ownedFilePaths: ownedFiles,
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
