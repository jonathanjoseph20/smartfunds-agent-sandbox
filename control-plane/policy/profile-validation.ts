import { PROFILE_CAPABILITIES } from './capabilities.ts';
import { classifyCapability, classifyMutationIntent, classifyScope, resolveRequiredProfile } from './core-classification.ts';
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
  'docs_change',
  'entity_registry_change',
  'entity_registry_mutation',
  'financial_logic_change',
  'financial_rail_mutation',
  'governance_change',
  'non_core_code_change',
  'product_update',
  'protected_infra_change',
  'protected_infra_mutation',
  'runtime_kernel_change',
  'tooling_change',
  'ui_change',
  'workflow_change',
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

function profileRank(profile: PolicyProfile): number {
  if (profile === 'core') {
    return 2;
  }
  if (profile === 'build') {
    return 1;
  }
  return 0;
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

  const capabilityClassifications = requestedCapabilities
    .filter((capability): capability is CapabilityClass => CAPABILITY_CLASSES.includes(capability as CapabilityClass))
    .map((capability) => classifyCapability(capability))
    .sort((left, right) => left.capability.localeCompare(right.capability));

  const knownMutationIntent = MUTATION_INTENTS.includes(mutationIntent as MutationIntent);
  const mutationIntentClassification = classifyMutationIntent(
    knownMutationIntent ? mutationIntent as MutationIntent : 'none'
  );

  const scopeClassification = classifyScope({
    registry,
    targetScope: input.targetScope
  });

  const requiredProfile = resolveRequiredProfile([
    scopeClassification.requiredProfile,
    mutationIntentClassification.requiredProfile,
    ...capabilityClassifications.map((classification) => classification.requiredProfile)
  ]);

  const coreReasons = sortedUnique([
    ...(scopeClassification.requiredProfile === 'core' ? [scopeClassification.reason] : []),
    ...(mutationIntentClassification.requiredProfile === 'core' ? [mutationIntentClassification.reason] : []),
    ...capabilityClassifications
      .filter((classification) => classification.requiredProfile === 'core')
      .map((classification) => classification.reason)
  ]);

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

    if (knownProfile && profileRank(profile) < profileRank(classifyCapability(capability as CapabilityClass).requiredProfile)) {
      violations.push(`capability_${capability}_requires_${classifyCapability(capability as CapabilityClass).requiredProfile}_profile`);
    }
  }

  if (!knownMutationIntent) {
    violations.push(`unknown_mutation_intent_${mutationIntent}`);
  } else if (knownProfile) {
    const profileConfig = registry.profiles[profile];
    if (profileConfig.mutationAllowed === false && mutationIntent !== 'none') {
      violations.push(`profile_${profile}_disallows_mutation_intent_${mutationIntent}`);
    }

    if (profileRank(profile) < profileRank(mutationIntentClassification.requiredProfile)) {
      violations.push(
        `mutation_intent_${mutationIntentClassification.normalizedIntent}_requires_${mutationIntentClassification.requiredProfile}_profile`
      );
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
        if (!allowedPatterns.some((pattern) => {
          const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
          const expression = escaped
            .replace(/\*\*/g, '__DOUBLE_STAR__')
            .replace(/\*/g, '[^/]*')
            .replace(/__DOUBLE_STAR__/g, '.*');
          return new RegExp(`^${expression}$`).test(requestedPath);
        })) {
          violations.push(`profile_${profile}_disallows_target_path_${requestedPath}`);
        }
      }
    }

    if (profileRank(profile) < profileRank(scopeClassification.requiredProfile)) {
      violations.push(`target_scope_requires_${scopeClassification.requiredProfile}_profile`);
    }

    if (
      profile === 'build'
      && scopeClassification.requiredProfile === 'core'
      && (scopeClassification.reason === 'target_scope_matches_core_registry'
        || scopeClassification.reason === 'target_repo_marked_core_only'
        || scopeClassification.reason === 'target_scope_requires_core_profile')
    ) {
      violations.push('build_cannot_target_core_scope');
    }
  }

  return {
    ok: violations.length === 0,
    requestedProfile: profile,
    requiredProfile,
    profile,
    scopeClassification,
    coreScopeMatched: scopeClassification.coreScopeMatched,
    coreReasons,
    mutationIntentClassification,
    capabilityClassifications,
    violations: sortedUnique(violations),
    allowedCapabilities
  };
}
