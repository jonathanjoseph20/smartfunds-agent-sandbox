import type {
  CapabilityClass,
  CapabilityClassification,
  MutationIntent,
  MutationIntentClassification,
  PolicyProfile,
  ScopeClassification,
  TargetScope
} from './types.ts';
import type { ScopeRegistry } from './scope-registry.ts';

const CORE_REQUIRED_CAPABILITIES = new Set<CapabilityClass>(['protected_write']);

const BUILD_SAFE_MUTATION_INTENTS = new Set<MutationIntent>([
  'none',
  'artifact',
  'code_change',
  'docs_change',
  'non_core_code_change',
  'ui_change',
  'product_update',
  'tooling_change'
]);

const CORE_REQUIRED_MUTATION_INTENTS = new Set<MutationIntent>([
  'governance_change',
  'workflow_change',
  'runtime_kernel_change',
  'financial_logic_change',
  'entity_registry_change',
  'protected_infra_change'
]);

const MUTATION_INTENT_ALIASES: Partial<Record<MutationIntent, MutationIntent>> = {
  control_plane_mutation: 'runtime_kernel_change',
  entity_registry_mutation: 'entity_registry_change',
  financial_rail_mutation: 'financial_logic_change',
  protected_infra_mutation: 'protected_infra_change'
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
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

function profileRank(profile: PolicyProfile): number {
  if (profile === 'core') {
    return 2;
  }
  if (profile === 'build') {
    return 1;
  }
  return 0;
}

export function resolveRequiredProfile(profiles: PolicyProfile[]): PolicyProfile {
  return [...profiles]
    .sort((left, right) => profileRank(right) - profileRank(left))
    .at(0) ?? 'lite';
}

export function classifyCapability(capability: CapabilityClass): CapabilityClassification {
  if (CORE_REQUIRED_CAPABILITIES.has(capability)) {
    return {
      capability,
      requiredProfile: 'core',
      reason: 'capability_requires_core_profile'
    };
  }

  if (capability === 'repo_write' || capability === 'pr_open') {
    return {
      capability,
      requiredProfile: 'build',
      reason: 'capability_requires_build_profile'
    };
  }

  return {
    capability,
    requiredProfile: 'lite',
    reason: 'capability_allowed_in_lite_profile'
  };
}

export function classifyMutationIntent(intent: MutationIntent): MutationIntentClassification {
  const normalizedIntent = MUTATION_INTENT_ALIASES[intent] ?? intent;

  if (CORE_REQUIRED_MUTATION_INTENTS.has(normalizedIntent)) {
    return {
      intent,
      normalizedIntent,
      requiredProfile: 'core',
      reason: 'mutation_intent_requires_core_profile'
    };
  }

  if (BUILD_SAFE_MUTATION_INTENTS.has(normalizedIntent)) {
    return {
      intent,
      normalizedIntent,
      requiredProfile: normalizedIntent === 'none' ? 'lite' : 'build',
      reason: normalizedIntent === 'none'
        ? 'mutation_intent_non_mutating'
        : 'mutation_intent_allowed_for_build_profile'
    };
  }

  return {
    intent,
    normalizedIntent,
    requiredProfile: 'core',
    reason: 'mutation_intent_unmapped_defaults_core'
  };
}

export function classifyScope(input: {
  targetScope?: TargetScope;
  registry: ScopeRegistry;
}): ScopeClassification {
  if (!input.targetScope) {
    return {
      requiredProfile: 'lite',
      reason: 'no_target_scope_provided',
      coreScopeMatched: false,
      allowedForBuild: true,
      matchedBuildPaths: [],
      matchedCorePaths: [],
      unmatchedPaths: []
    };
  }

  const repo = input.targetScope.repo;
  const paths = sortedUnique((input.targetScope.paths ?? []).map((path) => path.trim()).filter((path) => path.length > 0));

  const buildAllowedRepos = new Set(input.registry.profiles.build.allowedRepos ?? []);
  const buildPatterns = input.registry.profiles.build.allowedPaths?.[repo] ?? [];

  const coreAllowedRepos = new Set(input.registry.profiles.core.allowedRepos ?? []);
  const coreOnlyRepos = new Set(input.registry.profiles.core.coreOnlyRepos ?? []);
  const corePatterns = input.registry.profiles.core.coreOnlyPaths?.[repo]
    ?? input.registry.profiles.core.allowedPaths?.[repo]
    ?? [];

  const matchedBuildPaths = sortedUnique(paths.filter((path) => pathAllowed(path, buildPatterns)));
  const matchedCorePaths = sortedUnique(paths.filter((path) => pathAllowed(path, corePatterns)));
  const unmatchedPaths = sortedUnique(paths.filter((path) => !pathAllowed(path, buildPatterns) && !pathAllowed(path, corePatterns)));

  const coreScopeMatched = matchedCorePaths.length > 0;

  if (paths.length === 0) {
    if (coreOnlyRepos.has(repo)) {
      return {
        requiredProfile: 'core',
        reason: 'target_repo_marked_core_only',
        coreScopeMatched: true,
        allowedForBuild: false,
        matchedBuildPaths: [],
        matchedCorePaths: [],
        unmatchedPaths: []
      };
    }

    if (buildAllowedRepos.has(repo)) {
      return {
        requiredProfile: 'build',
        reason: 'target_repo_allowed_for_build_profile',
        coreScopeMatched,
        allowedForBuild: true,
        matchedBuildPaths: [],
        matchedCorePaths: [],
        unmatchedPaths: []
      };
    }

    if (coreAllowedRepos.has(repo)) {
      return {
        requiredProfile: 'core',
        reason: 'target_repo_requires_core_profile',
        coreScopeMatched,
        allowedForBuild: false,
        matchedBuildPaths: [],
        matchedCorePaths: [],
        unmatchedPaths: []
      };
    }

    return {
      requiredProfile: 'core',
      reason: 'target_repo_unmapped_defaults_core',
      coreScopeMatched: true,
      allowedForBuild: false,
      matchedBuildPaths: [],
      matchedCorePaths: [],
      unmatchedPaths: []
    };
  }

  if (matchedCorePaths.length > 0) {
    return {
      requiredProfile: 'core',
      reason: 'target_scope_matches_core_registry',
      coreScopeMatched: true,
      allowedForBuild: false,
      matchedBuildPaths,
      matchedCorePaths,
      unmatchedPaths
    };
  }

  if (unmatchedPaths.length > 0) {
    return {
      requiredProfile: 'core',
      reason: 'target_scope_unmapped_defaults_core',
      coreScopeMatched: true,
      allowedForBuild: false,
      matchedBuildPaths,
      matchedCorePaths,
      unmatchedPaths
    };
  }

  if (buildAllowedRepos.has(repo) && matchedBuildPaths.length > 0) {
    return {
      requiredProfile: 'build',
      reason: 'target_scope_matches_build_registry',
      coreScopeMatched,
      allowedForBuild: true,
      matchedBuildPaths,
      matchedCorePaths,
      unmatchedPaths
    };
  }

  return {
    requiredProfile: 'core',
    reason: 'target_scope_requires_core_profile',
    coreScopeMatched: true,
    allowedForBuild: false,
    matchedBuildPaths,
    matchedCorePaths,
    unmatchedPaths
  };
}
