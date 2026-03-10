export type PolicyProfile =
  | 'lite'
  | 'build'
  | 'core';

export type CapabilityClass =
  | 'read'
  | 'artifact_write'
  | 'repo_write'
  | 'pr_open'
  | 'protected_write';

export type MutationIntent =
  | 'none'
  | 'artifact'
  | 'code_change'
  | 'docs_change'
  | 'non_core_code_change'
  | 'ui_change'
  | 'product_update'
  | 'tooling_change'
  | 'governance_change'
  | 'workflow_change'
  | 'runtime_kernel_change'
  | 'financial_logic_change'
  | 'entity_registry_change'
  | 'protected_infra_change'
  | 'protected_infra_mutation'
  | 'financial_rail_mutation'
  | 'entity_registry_mutation'
  | 'control_plane_mutation';

export interface TargetScope {
  repo: string;
  paths?: string[];
}

export interface CapabilityClassification {
  capability: CapabilityClass;
  requiredProfile: PolicyProfile;
  reason: string;
}

export interface MutationIntentClassification {
  intent: MutationIntent;
  normalizedIntent: MutationIntent;
  requiredProfile: PolicyProfile;
  reason: string;
}

export interface ScopeClassification {
  requiredProfile: PolicyProfile;
  reason: string;
  coreScopeMatched: boolean;
  allowedForBuild: boolean;
  matchedBuildPaths: string[];
  matchedCorePaths: string[];
  unmatchedPaths: string[];
}

export interface ProfileValidationResult {
  ok: boolean;
  requestedProfile: PolicyProfile | string;
  requiredProfile: PolicyProfile;
  profile: PolicyProfile | string;
  scopeClassification: ScopeClassification;
  coreScopeMatched: boolean;
  coreReasons: string[];
  mutationIntentClassification: MutationIntentClassification;
  capabilityClassifications: CapabilityClassification[];
  violations: string[];
  allowedCapabilities: CapabilityClass[];
}
