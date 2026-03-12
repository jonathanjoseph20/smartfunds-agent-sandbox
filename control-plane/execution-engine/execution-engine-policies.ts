import type { ExecutionEnginePolicy } from './execution-engine-policy-types.ts';

const SEEDED_POLICIES: ExecutionEnginePolicy[] = [
  {
    enginePolicyId: 'simulation-only-default',
    displayName: 'Simulation Only Default',
    description: 'Conservative bounded execution policy with simulation-only runtime mode.',
    requiresEligibleAttempt: true,
    requiresReadyJournal: true,
    requiresEligibleRuntimeEnvelope: true,
    requiresExecutionContractReady: true,
    allowsLiveExecution: false,
    allowsSimulationOnly: true,
    requiresFounderEngineConfirmation: false,
    enabled: true,
    defaultRunMode: 'simulation_only',
  },
  {
    enginePolicyId: 'manual-engine-gated',
    displayName: 'Manual Engine Gated',
    description: 'Requires explicit founder confirmation before allowing engine start.',
    requiresEligibleAttempt: true,
    requiresReadyJournal: true,
    requiresEligibleRuntimeEnvelope: true,
    requiresExecutionContractReady: true,
    allowsLiveExecution: false,
    allowsSimulationOnly: true,
    requiresFounderEngineConfirmation: true,
    enabled: true,
    defaultRunMode: 'manual_engine_gate',
  },
  {
    enginePolicyId: 'bounded-local-execution',
    displayName: 'Bounded Local Execution',
    description: 'Reserved bounded local execution mode with strict safeguards.',
    requiresEligibleAttempt: true,
    requiresReadyJournal: true,
    requiresEligibleRuntimeEnvelope: true,
    requiresExecutionContractReady: true,
    allowsLiveExecution: true,
    allowsSimulationOnly: true,
    requiresFounderEngineConfirmation: true,
    enabled: false,
    defaultRunMode: 'bounded_local_execution',
  },
];

export const DEFAULT_EXECUTION_ENGINE_POLICY_ID = 'simulation-only-default';

export function listExecutionEnginePolicies(): ExecutionEnginePolicy[] {
  return [...SEEDED_POLICIES].sort((left, right) => left.enginePolicyId.localeCompare(right.enginePolicyId));
}

export function getExecutionEnginePolicy(enginePolicyId: string): ExecutionEnginePolicy {
  const policy = SEEDED_POLICIES.find((entry) => entry.enginePolicyId === enginePolicyId);
  if (!policy) {
    throw new Error(`EXECUTION_ENGINE_POLICY_NOT_FOUND: ${enginePolicyId}`);
  }
  return policy;
}
