import {
  deriveMissionPortfolioStatePropagationId,
  uniqueSortedStrings,
} from './runtime-outcome-propagation-identity.ts';
import type {
  MissionPortfolioStatePropagation,
  MissionPortfolioStatePropagationClass,
  RuntimeOutcomePropagationRecordState,
} from './runtime-outcome-propagation-types.ts';

export function deriveMissionPortfolioStatePropagationClass(input: {
  runtimeStatus: string;
  healthState: string;
  readinessState: string;
}): MissionPortfolioStatePropagationClass {
  if (input.runtimeStatus === 'runtime_failed') {
    return input.healthState === 'unhealthy' ? 'portfolio_stabilization_regressed' : 'portfolio_resolution_blocked';
  }
  if (input.runtimeStatus === 'runtime_completed') {
    if (input.healthState === 'healthy') {
      return 'portfolio_stabilization_improved';
    }
    if (input.readinessState === 'ready') {
      return 'portfolio_attention_cleared';
    }
    return 'portfolio_resolution_advanced';
  }
  if (input.runtimeStatus === 'runtime_deferred') {
    return 'portfolio_closure_eligibility_changed';
  }
  return 'portfolio_attention_cleared';
}

export function deriveMissionPortfolioStatePropagationState(input: {
  propagationClass: MissionPortfolioStatePropagationClass;
}): RuntimeOutcomePropagationRecordState {
  if (input.propagationClass === 'portfolio_closure_eligibility_changed') {
    return 'active';
  }
  return 'resolved';
}

export function createMissionPortfolioStatePropagation(input: {
  runtimeOutcomePropagationRecordId: string;
  missionPortfolioId: string;
  runtimeStatus: string;
  healthState: string;
  readinessState: string;
  reasonTokens?: string[];
}): MissionPortfolioStatePropagation {
  const propagationClass = deriveMissionPortfolioStatePropagationClass({
    runtimeStatus: input.runtimeStatus,
    healthState: input.healthState,
    readinessState: input.readinessState,
  });

  const reasonTokens = uniqueSortedStrings([
    `runtime_status:${input.runtimeStatus}`,
    `health_state:${input.healthState}`,
    `readiness_state:${input.readinessState}`,
    `propagation_class:${propagationClass}`,
    ...(input.reasonTokens ?? []),
  ]);

  return {
    missionPortfolioStatePropagationId: deriveMissionPortfolioStatePropagationId({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      missionPortfolioId: input.missionPortfolioId,
      propagationClass,
      reasonTokens,
    }),
    runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
    missionPortfolioId: input.missionPortfolioId,
    propagationClass,
    reasonTokens,
    state: deriveMissionPortfolioStatePropagationState({ propagationClass }),
  };
}
