import type { ExecutionTargetKind } from './runtime-envelope-types.ts';

export interface RuntimeEnvelopePolicyConfig {
  defaultCapabilitiesDisabled: boolean;
  defaultTaskGraphDisabled: boolean;
  defaultResourceBindingDisabled: boolean;
  allowedExecutionTargets: ExecutionTargetKind[];
}

export interface RuntimeEnvelopePolicy {
  runtimeEnvelopePolicyId: string;
  displayName: string;
  description: string;
  enabled: boolean;
  config: RuntimeEnvelopePolicyConfig;
}
