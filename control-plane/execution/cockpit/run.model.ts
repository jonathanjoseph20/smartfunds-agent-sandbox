import { sha256 } from '../../finance/determinism.ts';
import type { CreateRunInput, Run } from './run.types.ts';

export function computeRunId(input: CreateRunInput & { attemptIndex: number }): string {
  return sha256(`${input.projectId}${input.teamId}${input.goalId}${String(input.attemptIndex)}`);
}

export function createRunObject(input: CreateRunInput & { attemptIndex: number }): Run {
  return {
    runId: computeRunId(input),
    projectId: input.projectId,
    teamId: input.teamId,
    goalId: input.goalId,
    executionMode: 'structured',
    status: 'created',
    attemptIndex: input.attemptIndex
  };
}
