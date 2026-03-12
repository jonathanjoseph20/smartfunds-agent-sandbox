import type {
  MissionPriorityLevel,
  MissionPrioritySignal,
} from './mission-coordination.ts';
import {
  computeMissionCoordinationSemanticId,
  normalizeReasonTokens,
} from './mission-coordination.ts';

export function deriveMissionPriorityUpdateId(input: {
  missionRunId: string;
  priority: MissionPriorityLevel;
  reasonTokens?: string[];
}): string {
  return computeMissionCoordinationSemanticId({
    missionRunId: input.missionRunId,
    priority: input.priority,
    reasonTokens: normalizeReasonTokens(input.reasonTokens),
  });
}

export function createMissionPrioritySignal(input: {
  missionRunId: string;
  priority: MissionPriorityLevel;
  reasonTokens?: string[];
}): MissionPrioritySignal {
  return {
    missionRunId: input.missionRunId,
    priority: input.priority,
    reasonTokens: normalizeReasonTokens(input.reasonTokens),
  };
}
