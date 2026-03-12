import type { MissionActivationPolicy } from './mission-activation-policy-types.ts';

const SEEDED_POLICIES: MissionActivationPolicy[] = [
  {
    activationPolicyId: 'strict-founder-gated-activation',
    displayName: 'Strict Founder Gated Activation',
    description: 'Requires explicit assignment confirmation, mission readiness, DAG dependency readiness, team readiness/availability, and explicit founder activation confirmation.',
    requiresConfirmedAssignment: true,
    requiresMissionReady: true,
    requiresDagDependenciesSatisfied: true,
    requiresTeamReady: true,
    requiresTeamAvailable: true,
    requiresFounderActivationConfirmation: true,
    enabled: true,
  },
  {
    activationPolicyId: 'confirmed-assignment-default',
    displayName: 'Confirmed Assignment Default',
    description: 'Requires a confirmed assignment and readiness checks but does not require explicit founder activation confirmation.',
    requiresConfirmedAssignment: true,
    requiresMissionReady: true,
    requiresDagDependenciesSatisfied: true,
    requiresTeamReady: true,
    requiresTeamAvailable: true,
    requiresFounderActivationConfirmation: false,
    enabled: true,
  },
  {
    activationPolicyId: 'manual-gate-only',
    displayName: 'Manual Gate Only',
    description: 'Runs deterministic preconditions and always requires manual gate review before activation readiness can be advanced.',
    requiresConfirmedAssignment: false,
    requiresMissionReady: true,
    requiresDagDependenciesSatisfied: true,
    requiresTeamReady: true,
    requiresTeamAvailable: true,
    requiresFounderActivationConfirmation: false,
    enabled: true,
  },
];

export const DEFAULT_MISSION_ACTIVATION_POLICY_ID = 'strict-founder-gated-activation';

export function listMissionActivationPolicies(): MissionActivationPolicy[] {
  return [...SEEDED_POLICIES].sort((left, right) => left.activationPolicyId.localeCompare(right.activationPolicyId));
}

export function getMissionActivationPolicy(activationPolicyId: string): MissionActivationPolicy {
  const policy = SEEDED_POLICIES.find((entry) => entry.activationPolicyId === activationPolicyId && entry.enabled);
  if (!policy) {
    throw new Error(`MISSION_ACTIVATION_POLICY_NOT_FOUND: ${activationPolicyId}`);
  }
  return policy;
}
