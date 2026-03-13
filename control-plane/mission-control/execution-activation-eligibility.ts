import {
  deriveExecutionActivationEligibilityId,
  uniqueSortedStrings,
} from './mission-execution-activation-identity.ts';
import type {
  ExecutionActivationEligibility,
  ExecutionActivationEligibilityValue,
} from './mission-execution-activation-types.ts';
import type {
  ExecutionRequestRecord,
  MissionExecutionCoordinationProjection,
} from './mission-execution-coordination-types.ts';

export interface RuntimeCapabilitySurface {
  targetExecutionDomain: string;
  capabilityStatus: 'enabled' | 'degraded' | 'disabled' | 'inconclusive';
  reasonTokens?: string[];
}

function evaluateEligibility(input: {
  request: ExecutionRequestRecord;
  missionExecutionCoordinationProjection: MissionExecutionCoordinationProjection;
  runtimeCapability: RuntimeCapabilitySurface | null;
}): {
  eligibilityStatus: ExecutionActivationEligibilityValue;
  reasonTokens: string[];
  blockingConditionTokens: string[];
  state: ExecutionActivationEligibility['state'];
} {
  const blockingConditionTokens: string[] = [];
  const reasonTokens: string[] = [
    `request_state:${input.request.state}`,
    `coordination_status:${input.missionExecutionCoordinationProjection.status.status}`,
  ];

  if (input.missionExecutionCoordinationProjection.status.status === 'inconclusive' || input.request.state === 'inconclusive') {
    return {
      eligibilityStatus: 'inconclusive',
      reasonTokens: uniqueSortedStrings([...reasonTokens, 'eligibility:inconclusive']),
      blockingConditionTokens: [],
      state: 'inconclusive',
    };
  }

  if (input.request.state === 'failed') {
    blockingConditionTokens.push('request_failed');
  }

  if (input.missionExecutionCoordinationProjection.status.status === 'execution_failed') {
    blockingConditionTokens.push('coordination_failed');
  }

  if (input.runtimeCapability?.capabilityStatus === 'disabled') {
    blockingConditionTokens.push(`runtime_capability_disabled:${input.request.targetExecutionDomain}`);
  }

  if (blockingConditionTokens.length > 0) {
    return {
      eligibilityStatus: 'blocked_from_activation',
      reasonTokens: uniqueSortedStrings([
        ...reasonTokens,
        ...blockingConditionTokens,
        ...(input.runtimeCapability?.reasonTokens ?? []),
      ]),
      blockingConditionTokens: uniqueSortedStrings(blockingConditionTokens),
      state: 'resolved',
    };
  }

  if (input.request.state === 'deferred' || input.missionExecutionCoordinationProjection.status.status === 'execution_deferred') {
    return {
      eligibilityStatus: 'not_eligible',
      reasonTokens: uniqueSortedStrings([
        ...reasonTokens,
        'deferred',
      ]),
      blockingConditionTokens: [],
      state: 'resolved',
    };
  }

  if (input.runtimeCapability?.capabilityStatus === 'degraded') {
    return {
      eligibilityStatus: 'conditionally_eligible',
      reasonTokens: uniqueSortedStrings([
        ...reasonTokens,
        `runtime_capability_degraded:${input.request.targetExecutionDomain}`,
        ...(input.runtimeCapability.reasonTokens ?? []),
      ]),
      blockingConditionTokens: [],
      state: 'active',
    };
  }

  if (input.request.state === 'created' || input.request.state === 'queued') {
    return {
      eligibilityStatus: 'conditionally_eligible',
      reasonTokens: uniqueSortedStrings([
        ...reasonTokens,
        'request_not_submitted',
      ]),
      blockingConditionTokens: [],
      state: 'active',
    };
  }

  return {
    eligibilityStatus: 'eligible',
    reasonTokens: uniqueSortedStrings([
      ...reasonTokens,
      ...(input.runtimeCapability?.reasonTokens ?? []),
      'eligible',
    ]),
    blockingConditionTokens: [],
    state: 'active',
  };
}

export function deriveExecutionActivationEligibility(input: {
  request: ExecutionRequestRecord;
  missionExecutionCoordinationProjection: MissionExecutionCoordinationProjection;
  runtimeCapabilities?: RuntimeCapabilitySurface[];
}): ExecutionActivationEligibility {
  const runtimeCapability = (input.runtimeCapabilities ?? [])
    .find((entry) => entry.targetExecutionDomain === input.request.targetExecutionDomain) ?? null;

  const evaluated = evaluateEligibility({
    request: input.request,
    missionExecutionCoordinationProjection: input.missionExecutionCoordinationProjection,
    runtimeCapability,
  });

  return {
    executionActivationEligibilityId: deriveExecutionActivationEligibilityId({
      executionRequestRecordId: input.request.executionRequestRecordId,
      eligibilityStatus: evaluated.eligibilityStatus,
      reasonTokens: evaluated.reasonTokens,
      blockingConditionTokens: evaluated.blockingConditionTokens,
    }),
    executionRequestRecordId: input.request.executionRequestRecordId,
    eligibilityStatus: evaluated.eligibilityStatus,
    reasonTokens: evaluated.reasonTokens,
    blockingConditionTokens: evaluated.blockingConditionTokens,
    state: evaluated.state,
  };
}
