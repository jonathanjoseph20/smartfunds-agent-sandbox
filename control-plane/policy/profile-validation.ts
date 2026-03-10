import { PROFILE_CAPABILITIES } from './capabilities.ts';
import { loadScopeRegistry, type ScopeRegistry } from './scope-registry.ts';
import type {
  CapabilityClass,
  MutationIntent,
  PolicyProfile,
  ProfileValidationResult,
  TargetScope
} from './types.ts';

const CAPABILITY_CLASSES: CapabilityClass[] = [
  'artifact_write',
  'pr_open',
  'protected_write',
  'read',
  'repo_write'
];

const MUTATION_INTENTS: MutationIntent[] = [
  'artifact',
  'code_change',
  'control_plane_mutation',
  'entity_registry_mutation',
  'financial_rail_mutation',
  'governance_change',
  'product_update',
  'protected_infra_mutation',
  'tooling_change',
  'ui_change',
  'none'
];

export type ProfileValidationInput = {
  profile: PolicyProfile | string;
  requestedCapabilities?: CapabilityClass[] | string[];
  targetScope?: TargetScope;
  mutationIntent?: MutationIntent | string;
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function asSortedCapabilities(values: CapabilityClass[]): CapabilityClass[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function isPolicyProfile(profile: string): profile is PolicyProfile {
  return profile === 'lite' || profile === 'build' || profile === 'core';
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

function pathAllowed(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}

export function validateProfileRequest(
  input: ProfileValidationInput,
  registry: ScopeRegistry = loadScopeRegistry()
): ProfileValidationResult {
  const profile = input.profile;
  const requestedCapabilities = sortedUnique((input.requestedCapabilities ?? []) as string[]);
  const mutationIntent = input.mutationIntent ?? 'none';
  const violations: string[] = [];

  const knownProfile = isPolicyProfile(profile);
  const allowedCapabilities = knownProfile
    ? asSortedCapabilities(PROFILE_CAPABILITIES[profile])
    : [];

  if (!knownProfile) {
    violations.push(`unknown_profile_${profile}`);
  }

  for (const capability of requestedCapabilities) {
    if (!CAPABILITY_CLASSES.includes(capability as CapabilityClass)) {
      violations.push(`unknown_capability_${capability}`);
      continue;
    }

    if (knownProfile && !allowedCapabilities.includes(capability as CapabilityClass)) {
      violations.push(`profile_${profile}_disallows_${capability}`);
    }
  }

  if (!MUTATION_INTENTS.includes(mutationIntent as MutationIntent)) {
    violations.push(`unknown_mutation_intent_${mutationIntent}`);
  } else if (knownProfile) {
    const profileConfig = registry.profiles[profile];
    if (profileConfig.mutationAllowed === false && mutationIntent !== 'none') {
      violations.push(`profile_${profile}_disallows_mutation_intent_${mutationIntent}`);
    }
  }

  if (input.targetScope && knownProfile) {
    const targetRepo = input.targetScope.repo;
    const profileConfig = registry.profiles[profile];
    const allowedRepos = profileConfig.allowedRepos ?? [];

    if (!allowedRepos.includes(targetRepo)) {
      violations.push(`profile_${profile}_disallows_target_repo`);
    }

    if (input.targetScope.paths && input.targetScope.paths.length > 0) {
      const allowedPatterns = profileConfig.allowedPaths?.[targetRepo] ?? [];
      const requestedPaths = sortedUnique(input.targetScope.paths);

      for (const requestedPath of requestedPaths) {
        if (!pathAllowed(requestedPath, allowedPatterns)) {
          violations.push(`profile_${profile}_disallows_target_path_${requestedPath}`);
        }
      }
    }
  }

  return {
    ok: violations.length === 0,
    profile,
    violations: sortedUnique(violations),
    allowedCapabilities
  };
}
