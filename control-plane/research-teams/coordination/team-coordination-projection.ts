import type {
  TeamCoordinationEvent,
  TeamCoordinationProjection
} from './team-coordination-types.ts';

function compareForReplay(left: TeamCoordinationEvent, right: TeamCoordinationEvent): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = leftSlot.localeCompare(rightSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

export function projectTeamCoordinationState(input: {
  teamId: string;
  entries: TeamCoordinationEvent[];
}): TeamCoordinationProjection {
  const replay = [...input.entries].sort(compareForReplay);

  const initial: TeamCoordinationProjection = {
    teamId: input.teamId,
    priority: 'normal',
    readiness: 'ready',
    stabilizationState: 'stabilizing',
    activeInvestigations: [],
    linkedCohortIds: [],
    healthySlotCount: 0,
    lastEventType: null
  };

  return replay.reduce<TeamCoordinationProjection>((state, entry) => ({
    teamId: input.teamId,
    priority: entry.priority,
    readiness: entry.readiness,
    stabilizationState: entry.stabilizationState,
    activeInvestigations: [...entry.linkedInvestigationIds],
    linkedCohortIds: [...entry.linkedCohortIds],
    healthySlotCount: entry.healthySlotCount ?? state.healthySlotCount,
    lastEventType: entry.eventType
  }), initial);
}
