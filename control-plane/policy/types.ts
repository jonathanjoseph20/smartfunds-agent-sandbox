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
  | 'governance_change';

export interface TargetScope {
  repo: string;
  paths?: string[];
}

export interface ProfileValidationResult {
  ok: boolean;
  profile: PolicyProfile | string;
  violations: string[];
  allowedCapabilities: CapabilityClass[];
}
