import { normalizeChangedFiles } from './changed-files.ts';

export type Tier = 0 | 1 | 2 | 3;

export const TIER0_ALLOWLIST = {
  exact: ['README.md'],
  prefixes: ['docs/', 'apps/cockpit/', 'ui/', 'apps/web/'],
  suffixes: ['.md']
} as const;

export const TIER1_ALLOWLIST = {
  exact: ['control-plane/projects/docs.json'],
  prefixes: ['scripts/']
} as const;

export const TIER3_CRITICAL = {
  exact: ['control-plane/governance-runtime.ts', 'control-plane/governance-check.ts', 'control-plane/validate-pr.ts'],
  prefixes: [
    'governance/',
    '.github/workflows/',
    'control-plane/governance/',
    'control-plane/finance/',
    'control-plane/entities/rails',
    'control-plane/swarms/',
    'control-plane/swarm/',
    'control-plane/service/storage/',
    'runtime/'
  ]
} as const;

export const RESTRICTED_CORE_PREFIXES = ['control-plane/', 'runtime/'] as const;

function normalizePath(filePath: string): string {
  return filePath.replace(/^\.\//, '').replace(/^\/+/, '').trim();
}

function matchesExact(path: string, values: readonly string[]): boolean {
  return values.includes(path);
}

function matchesPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path.startsWith(prefix));
}

function matchesSuffix(path: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => path.endsWith(suffix));
}

function classifySinglePath(path: string): Tier {
  if (matchesExact(path, TIER1_ALLOWLIST.exact)) {
    return 1;
  }

  if (matchesExact(path, TIER3_CRITICAL.exact) || matchesPrefix(path, TIER3_CRITICAL.prefixes)) {
    return 3;
  }

  if (matchesPrefix(path, RESTRICTED_CORE_PREFIXES)) {
    return 2;
  }

  if (
    matchesExact(path, TIER0_ALLOWLIST.exact) ||
    matchesPrefix(path, TIER0_ALLOWLIST.prefixes) ||
    matchesSuffix(path, TIER0_ALLOWLIST.suffixes)
  ) {
    return 0;
  }

  if (matchesExact(path, TIER1_ALLOWLIST.exact) || matchesPrefix(path, TIER1_ALLOWLIST.prefixes)) {
    return 1;
  }

  return 2;
}

export function inferImpliedTierFromPaths(paths: string[]): Tier {
  const normalized = normalizeChangedFiles(paths.map((entry) => normalizePath(entry)));
  let tier: Tier = 0;
  for (const path of normalized) {
    const pathTier = classifySinglePath(path);
    if (pathTier > tier) {
      tier = pathTier;
    }
  }
  return tier;
}

export function classifyPaths(paths: string[]): {
  impliedTier: Tier;
  restrictedHits: string[];
  tier0Eligible: boolean;
  tier1Eligible: boolean;
} {
  const normalized = normalizeChangedFiles(paths.map((entry) => normalizePath(entry)));
  if (normalized.length === 0) {
    return {
      impliedTier: 0,
      restrictedHits: [],
      tier0Eligible: true,
      tier1Eligible: true
    };
  }

  let impliedTier: Tier = 0;
  const restrictedHits: string[] = [];
  let tier0Eligible = true;
  let tier1Eligible = true;

  for (const path of normalized) {
    const pathTier = classifySinglePath(path);
    if (pathTier > impliedTier) {
      impliedTier = pathTier;
    }
    if (pathTier > 1) {
      restrictedHits.push(path);
      tier1Eligible = false;
    }
    if (pathTier !== 0) {
      tier0Eligible = false;
    }
  }

  return {
    impliedTier,
    restrictedHits,
    tier0Eligible,
    tier1Eligible
  };
}
