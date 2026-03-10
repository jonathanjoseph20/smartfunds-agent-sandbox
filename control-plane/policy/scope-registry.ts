import fs from 'node:fs';

import type { PolicyProfile } from './types.ts';

const DEFAULT_SCOPE_REGISTRY_PATH = 'control-plane/policy/scope-registry.json';
const POLICY_PROFILES: PolicyProfile[] = ['lite', 'build', 'core'];

export type ScopeRegistryProfile = {
  mutationAllowed?: boolean;
  allowedRepos?: string[];
  allowedPaths?: Record<string, string[]>;
  coreOnlyRepos?: string[];
  coreOnlyPaths?: Record<string, string[]>;
};

export type ScopeRegistry = {
  version: number;
  profiles: Record<PolicyProfile, ScopeRegistryProfile>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function validatePathPattern(pattern: string, label: string): void {
  if (pattern !== pattern.trim()) {
    throw new Error(`${label} contains invalid path pattern: ${pattern}`);
  }
  if (pattern.startsWith('/')) {
    throw new Error(`${label} contains invalid path pattern: ${pattern}`);
  }
  if (pattern.includes('\\')) {
    throw new Error(`${label} contains invalid path pattern: ${pattern}`);
  }
  if (pattern.includes('..')) {
    throw new Error(`${label} contains invalid path pattern: ${pattern}`);
  }
  if (/\s/.test(pattern)) {
    throw new Error(`${label} contains invalid path pattern: ${pattern}`);
  }
}

function parseRepos(value: unknown, label: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }

  const repos = value as string[];
  const unique = sortedUnique(repos);
  if (unique.length !== repos.length) {
    throw new Error(`${label} contains duplicate repositories.`);
  }

  return unique;
}

function parseAllowedPaths(value: unknown, label: string): Record<string, string[]> | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertPlainObject(value, label);

  const entries = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right));

  const normalized: Record<string, string[]> = {};

  for (const [repo, patternsValue] of entries) {
    if (!isNonEmptyString(repo)) {
      throw new Error(`${label} must map repository names to path patterns.`);
    }
    if (!Array.isArray(patternsValue) || !patternsValue.every(isNonEmptyString)) {
      throw new Error(`${label}.${repo} must be an array of non-empty strings.`);
    }

    const patterns = patternsValue as string[];
    for (const pattern of patterns) {
      validatePathPattern(pattern, `${label}.${repo}`);
    }

    const uniquePatterns = sortedUnique(patterns);
    if (uniquePatterns.length !== patterns.length) {
      throw new Error(`${label}.${repo} contains duplicate path patterns.`);
    }

    normalized[repo] = uniquePatterns;
  }

  return normalized;
}

function parseProfile(value: unknown, profile: PolicyProfile): ScopeRegistryProfile {
  const label = `scope-registry.profiles.${profile}`;
  assertPlainObject(value, label);

  const record = value as Record<string, unknown>;
  const mutationAllowed = record.mutationAllowed;
  const allowedRepos = parseRepos(record.allowedRepos, `${label}.allowedRepos`);
  const allowedPaths = parseAllowedPaths(record.allowedPaths, `${label}.allowedPaths`);
  const coreOnlyRepos = parseRepos(record.coreOnlyRepos, `${label}.coreOnlyRepos`);
  const coreOnlyPaths = parseAllowedPaths(record.coreOnlyPaths, `${label}.coreOnlyPaths`);

  if (mutationAllowed !== undefined && typeof mutationAllowed !== 'boolean') {
    throw new Error(`${label}.mutationAllowed must be a boolean when provided.`);
  }

  if (profile === 'lite' && mutationAllowed === undefined) {
    throw new Error('scope-registry.profiles.lite.mutationAllowed must be defined.');
  }

  if (allowedPaths && allowedRepos) {
    const repoSet = new Set(allowedRepos);
    const unexpectedRepos = Object.keys(allowedPaths).filter((repo) => !repoSet.has(repo));
    if (unexpectedRepos.length > 0) {
      throw new Error(`${label}.allowedPaths contains repo(s) not listed in allowedRepos: ${sortedUnique(unexpectedRepos).join(', ')}.`);
    }
  }

  if (coreOnlyPaths && coreOnlyRepos) {
    const repoSet = new Set(coreOnlyRepos);
    const unexpectedRepos = Object.keys(coreOnlyPaths).filter((repo) => !repoSet.has(repo));
    if (unexpectedRepos.length > 0) {
      throw new Error(`${label}.coreOnlyPaths contains repo(s) not listed in coreOnlyRepos: ${sortedUnique(unexpectedRepos).join(', ')}.`);
    }
  }

  if (coreOnlyPaths && allowedPaths) {
    const allowedRepoSet = new Set(Object.keys(allowedPaths));
    const unexpectedRepos = Object.keys(coreOnlyPaths).filter((repo) => !allowedRepoSet.has(repo));
    if (unexpectedRepos.length > 0) {
      throw new Error(`${label}.coreOnlyPaths contains repo(s) not listed in allowedPaths: ${sortedUnique(unexpectedRepos).join(', ')}.`);
    }
  }

  if (coreOnlyRepos && allowedRepos) {
    const allowedRepoSet = new Set(allowedRepos);
    const unexpectedRepos = coreOnlyRepos.filter((repo) => !allowedRepoSet.has(repo));
    if (unexpectedRepos.length > 0) {
      throw new Error(`${label}.coreOnlyRepos contains repo(s) not listed in allowedRepos: ${sortedUnique(unexpectedRepos).join(', ')}.`);
    }
  }

  return {
    ...(mutationAllowed === undefined ? {} : { mutationAllowed }),
    ...(allowedRepos === undefined ? {} : { allowedRepos }),
    ...(allowedPaths === undefined ? {} : { allowedPaths }),
    ...(coreOnlyRepos === undefined ? {} : { coreOnlyRepos }),
    ...(coreOnlyPaths === undefined ? {} : { coreOnlyPaths })
  };
}

export function validateScopeRegistry(value: unknown): ScopeRegistry {
  assertPlainObject(value, 'scope-registry');

  const root = value as Record<string, unknown>;
  if (!Number.isInteger(root.version) || (root.version as number) <= 0) {
    throw new Error('scope-registry.version must be a positive integer.');
  }

  assertPlainObject(root.profiles, 'scope-registry.profiles');

  const profilesRecord = root.profiles as Record<string, unknown>;
  const unknownProfiles = Object.keys(profilesRecord).filter((key) => !POLICY_PROFILES.includes(key as PolicyProfile));
  if (unknownProfiles.length > 0) {
    throw new Error(`scope-registry.profiles contains unsupported profile(s): ${sortedUnique(unknownProfiles).join(', ')}.`);
  }

  const missingProfiles = POLICY_PROFILES.filter((profile) => profilesRecord[profile] === undefined);
  if (missingProfiles.length > 0) {
    throw new Error(`scope-registry.profiles missing required profile(s): ${missingProfiles.join(', ')}.`);
  }

  const profiles = POLICY_PROFILES.reduce<Record<PolicyProfile, ScopeRegistryProfile>>((acc, profile) => {
    acc[profile] = parseProfile(profilesRecord[profile], profile);
    return acc;
  }, {
    lite: {},
    build: {},
    core: {}
  });

  return {
    version: root.version as number,
    profiles
  };
}

export function loadScopeRegistry(filePath: string = DEFAULT_SCOPE_REGISTRY_PATH): ScopeRegistry {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return validateScopeRegistry(parsed);
}
