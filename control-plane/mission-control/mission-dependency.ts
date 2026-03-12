import type {
  MissionRelationship,
  MissionRelationshipState,
  MissionRelationshipType,
} from './mission-coordination.ts';
import {
  computeMissionCoordinationSemanticId,
  normalizeReasonTokens,
} from './mission-coordination.ts';

export function deriveMissionRelationshipId(input: {
  sourceMissionRunId: string;
  targetMissionRunId: string;
  relationshipType: MissionRelationshipType;
  blockingReasonTokens?: string[];
  state?: MissionRelationshipState;
}): string {
  return computeMissionCoordinationSemanticId({
    sourceMissionRunId: input.sourceMissionRunId,
    targetMissionRunId: input.targetMissionRunId,
    relationshipType: input.relationshipType,
    blockingReasonTokens: normalizeReasonTokens(input.blockingReasonTokens),
    state: input.state ?? 'active',
  });
}

export function createMissionRelationship(input: {
  sourceMissionRunId: string;
  targetMissionRunId: string;
  relationshipType: MissionRelationshipType;
  blockingReasonTokens?: string[];
  state?: MissionRelationshipState;
}): MissionRelationship {
  return {
    missionRelationshipId: deriveMissionRelationshipId(input),
    sourceMissionRunId: input.sourceMissionRunId,
    targetMissionRunId: input.targetMissionRunId,
    relationshipType: input.relationshipType,
    blockingReasonTokens: normalizeReasonTokens(input.blockingReasonTokens),
    state: input.state ?? 'active',
  };
}

export function unblockMissionRelationship(input: MissionRelationship): MissionRelationship {
  return createMissionRelationship({
    sourceMissionRunId: input.sourceMissionRunId,
    targetMissionRunId: input.targetMissionRunId,
    relationshipType: input.relationshipType,
    blockingReasonTokens: input.blockingReasonTokens,
    state: 'unblocked',
  });
}
