import type {
  MissionIntervention,
  MissionInterventionState,
  MissionInterventionType,
  MissionLifecycleState,
} from './mission-coordination.ts';
import {
  computeMissionCoordinationSemanticId,
  normalizeLinkedEscalationIds,
  normalizeReasonTokens,
} from './mission-coordination.ts';

export function deriveMissionInterventionId(input: {
  missionRunId: string;
  interventionType: MissionInterventionType;
  requestedBy: string;
  reasonTokens?: string[];
  targetLifecycleState?: MissionLifecycleState | null;
  linkedEscalationIds?: string[];
  state?: MissionInterventionState;
}): string {
  return computeMissionCoordinationSemanticId({
    missionRunId: input.missionRunId,
    interventionType: input.interventionType,
    requestedBy: input.requestedBy,
    reasonTokens: normalizeReasonTokens(input.reasonTokens),
    targetLifecycleState: input.targetLifecycleState ?? '',
    linkedEscalationIds: normalizeLinkedEscalationIds(input.linkedEscalationIds),
    state: input.state ?? 'recorded',
  });
}

export function createMissionIntervention(input: {
  missionRunId: string;
  interventionType: MissionInterventionType;
  requestedBy: string;
  reasonTokens?: string[];
  targetLifecycleState?: MissionLifecycleState | null;
  linkedEscalationIds?: string[];
  state?: MissionInterventionState;
}): MissionIntervention {
  return {
    missionInterventionId: deriveMissionInterventionId(input),
    missionRunId: input.missionRunId,
    interventionType: input.interventionType,
    requestedBy: input.requestedBy.trim(),
    reasonTokens: normalizeReasonTokens(input.reasonTokens),
    targetLifecycleState: input.targetLifecycleState ?? null,
    linkedEscalationIds: normalizeLinkedEscalationIds(input.linkedEscalationIds),
    state: input.state ?? 'recorded',
  };
}
