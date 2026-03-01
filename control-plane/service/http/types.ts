import type { SwarmExecutionArgs } from '../../swarms/swarmExecutor.ts';

export interface ExecuteRequestBody {
  swarmId: string;
  projectId: string;
  mode: 'structured' | 'autonomous';
  intent: string;
}

export type ValidationError = {
  error: string;
};

export function toSwarmExecutionArgs(body: ExecuteRequestBody): SwarmExecutionArgs {
  return {
    swarmId: body.swarmId,
    projectId: body.projectId,
    executionMode: body.mode,
    taskIntent: body.intent
  };
}
