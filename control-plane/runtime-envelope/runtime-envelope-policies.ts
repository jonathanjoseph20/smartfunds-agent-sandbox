import type { RuntimeEnvelopePolicy } from './runtime-envelope-policy-types.ts';

const SEEDED_POLICIES: RuntimeEnvelopePolicy[] = [
  {
    runtimeEnvelopePolicyId: 'strict-runtime-envelope',
    displayName: 'Strict Runtime Envelope',
    description: 'Builds a deterministic pre-execution runtime envelope with all runtime capabilities disabled.',
    enabled: true,
    config: {
      defaultCapabilitiesDisabled: true,
      defaultTaskGraphDisabled: true,
      defaultResourceBindingDisabled: true,
      allowedExecutionTargets: ['team_runtime', 'manual_operator', 'swarm_runtime', 'external_runtime'],
    },
  },
  {
    runtimeEnvelopePolicyId: 'manual-envelope-review',
    displayName: 'Manual Envelope Review',
    description: 'Builds deterministic envelope payloads and requires explicit review before runtime handoff.',
    enabled: true,
    config: {
      defaultCapabilitiesDisabled: true,
      defaultTaskGraphDisabled: true,
      defaultResourceBindingDisabled: true,
      allowedExecutionTargets: ['manual_operator', 'team_runtime'],
    },
  },
  {
    runtimeEnvelopePolicyId: 'future-runtime-enabled',
    displayName: 'Future Runtime Enabled',
    description: 'Reserved policy for future runtime support; currently remains projection-only in Sprint 5.2.',
    enabled: false,
    config: {
      defaultCapabilitiesDisabled: true,
      defaultTaskGraphDisabled: true,
      defaultResourceBindingDisabled: true,
      allowedExecutionTargets: ['team_runtime', 'manual_operator', 'swarm_runtime', 'external_runtime'],
    },
  },
];

export const DEFAULT_RUNTIME_ENVELOPE_POLICY_ID = 'strict-runtime-envelope';

export function listRuntimeEnvelopePolicies(): RuntimeEnvelopePolicy[] {
  return [...SEEDED_POLICIES].sort((left, right) => left.runtimeEnvelopePolicyId.localeCompare(right.runtimeEnvelopePolicyId));
}

export function getRuntimeEnvelopePolicy(runtimeEnvelopePolicyId: string): RuntimeEnvelopePolicy {
  const policy = SEEDED_POLICIES.find((entry) => entry.runtimeEnvelopePolicyId === runtimeEnvelopePolicyId);
  if (!policy) {
    throw new Error(`RUNTIME_ENVELOPE_POLICY_NOT_FOUND: ${runtimeEnvelopePolicyId}`);
  }
  return policy;
}
