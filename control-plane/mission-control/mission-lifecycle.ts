import type {
  InvalidLifecycleTransitionErrorPayload,
  MissionLifecycleState,
  MissionLifecycleTransition,
} from './mission-coordination.ts';
import {
  computeMissionCoordinationSemanticId,
  normalizeLinkedEscalationIds,
  normalizeReasonTokens,
} from './mission-coordination.ts';

const LIFECYCLE_TRANSITIONS: ReadonlyArray<readonly [MissionLifecycleState, MissionLifecycleState]> = [
  ['created', 'ready'],
  ['ready', 'active'],
  ['active', 'paused'],
  ['paused', 'resuming'],
  ['resuming', 'active'],
  ['active', 'blocked'],
  ['blocked', 'active'],
  ['active', 'completed'],
  ['active', 'failed'],
  ['active', 'cancelled'],
  ['paused', 'cancelled'],
];

export function isValidMissionLifecycleTransition(input: {
  fromState: MissionLifecycleState;
  toState: MissionLifecycleState;
}): boolean {
  return LIFECYCLE_TRANSITIONS.some(([fromState, toState]) => fromState === input.fromState && toState === input.toState);
}

export function deriveMissionLifecycleTransitionId(input: {
  missionRunId: string;
  fromState: MissionLifecycleState;
  toState: MissionLifecycleState;
  reasonTokens?: string[];
  linkedEscalationIds?: string[];
  linkedInterventionId?: string | null;
}): string {
  return computeMissionCoordinationSemanticId({
    missionRunId: input.missionRunId,
    fromState: input.fromState,
    toState: input.toState,
    reasonTokens: normalizeReasonTokens(input.reasonTokens),
    linkedEscalationIds: normalizeLinkedEscalationIds(input.linkedEscalationIds),
    linkedInterventionId: input.linkedInterventionId ?? '',
  });
}

export function createMissionLifecycleTransition(input: {
  missionRunId: string;
  fromState: MissionLifecycleState;
  toState: MissionLifecycleState;
  reasonTokens?: string[];
  linkedEscalationIds?: string[];
  linkedInterventionId?: string | null;
}): MissionLifecycleTransition | InvalidLifecycleTransitionErrorPayload {
  if (!isValidMissionLifecycleTransition({ fromState: input.fromState, toState: input.toState })) {
    return {
      error: 'invalid_lifecycle_transition',
      fromState: input.fromState,
      toState: input.toState,
      missionRunId: input.missionRunId,
    };
  }

  return {
    missionLifecycleTransitionId: deriveMissionLifecycleTransitionId(input),
    missionRunId: input.missionRunId,
    fromState: input.fromState,
    toState: input.toState,
    reasonTokens: normalizeReasonTokens(input.reasonTokens),
    linkedEscalationIds: normalizeLinkedEscalationIds(input.linkedEscalationIds),
    linkedInterventionId: input.linkedInterventionId ?? null,
  };
}
