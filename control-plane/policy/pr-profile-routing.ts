import { canonicalStringify } from '../finance/determinism.ts';
import { classifyScope, resolveRequiredProfile } from './core-classification.ts';
import { loadScopeRegistry } from './scope-registry.ts';
import type { PolicyProfile } from './types.ts';

export type ProfileDetectionSource = 'metadata' | 'fallback';

export type PrProfileRoutingInput = {
  prBody: string;
  changedFiles: string[];
  repository?: string;
};

export type PrProfileRoutingResult = {
  ok: boolean;
  profile: PolicyProfile;
  requestedProfile: PolicyProfile;
  requiredProfile: PolicyProfile;
  finalProfile: PolicyProfile;
  matchedScopes: string[];
  source: ProfileDetectionSource;
  changedFiles: string[];
  errors: string[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeRepository(repository: string | undefined): string | null {
  if (!repository) {
    return null;
  }

  const normalized = repository.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.includes('/')) {
    const parts = normalized.split('/').filter((entry) => entry.length > 0);
    return parts.at(-1) ?? null;
  }

  return normalized;
}

function parseMetadataProfile(prBody: string): PolicyProfile | null {
  const lines = prBody.replace(/\r\n?/g, '\n').split('\n');

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase().replace(/[\s_.-]/g, '');
    const value = line.slice(separatorIndex + 1).trim().toLowerCase();
    if (value !== 'lite' && value !== 'build' && value !== 'core') {
      continue;
    }

    if (key === 'profile' || key === 'missionprofile' || key === 'requestedprofile') {
      return value;
    }
  }

  return null;
}

function detectRequiredProfile(input: { changedFiles: string[]; repository: string | null }): {
  requiredProfile: PolicyProfile;
  matchedScopes: string[];
} {
  if (input.changedFiles.length === 0) {
    return {
      requiredProfile: 'lite',
      matchedScopes: []
    };
  }

  const registry = loadScopeRegistry();
  const repo = input.repository ?? 'smartfunds-agent-sandbox';
  const scopeClassification = classifyScope({
    registry,
    targetScope: {
      repo,
      paths: input.changedFiles
    }
  });

  return {
    requiredProfile: scopeClassification.requiredProfile,
    matchedScopes: sortedUnique([
      ...scopeClassification.matchedBuildPaths,
      ...scopeClassification.matchedCorePaths,
      ...scopeClassification.unmatchedPaths
    ])
  };
}

export function routePrGovernanceProfile(input: PrProfileRoutingInput): PrProfileRoutingResult {
  const changedFiles = sortedUnique(input.changedFiles.map((entry) => entry.trim()).filter((entry) => entry.length > 0));
  const requestedFromMetadata = parseMetadataProfile(input.prBody);
  const requestedProfile = requestedFromMetadata ?? 'lite';
  const source: ProfileDetectionSource = requestedFromMetadata ? 'metadata' : 'fallback';

  const required = detectRequiredProfile({
    changedFiles,
    repository: normalizeRepository(input.repository)
  });
  const finalProfile = resolveRequiredProfile([requestedProfile, required.requiredProfile]);

  const errors: string[] = [];
  if (requestedProfile === 'build' && required.requiredProfile === 'core') {
    errors.push('BUILD_REQUESTED_PROFILE_REQUIRES_CORE_SCOPE');
  }

  return {
    ok: errors.length === 0,
    profile: finalProfile,
    requestedProfile,
    requiredProfile: required.requiredProfile,
    finalProfile,
    matchedScopes: required.matchedScopes,
    source,
    changedFiles,
    errors
  };
}

export function formatPrProfileRouting(result: PrProfileRoutingResult): string {
  return canonicalStringify({
    profile: result.profile,
    requestedProfile: result.requestedProfile,
    requiredProfile: result.requiredProfile,
    finalProfile: result.finalProfile,
    matchedScopes: result.matchedScopes,
    source: result.source
  });
}
