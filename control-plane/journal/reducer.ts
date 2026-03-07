import type { ExecutionEvent, ExecutionRun, RunSummary } from './types.ts';

function sortedBySequence(events: ExecutionEvent[]): ExecutionEvent[] {
  return [...events].sort((left, right) => left.sequence - right.sequence);
}

function assertOrdered(events: ExecutionEvent[]): void {
  const ordered = sortedBySequence(events);
  for (let index = 0; index < ordered.length; index += 1) {
    const expected = index + 1;
    if (ordered[index].sequence !== expected) {
      throw new Error(`Invalid event ordering for run ${ordered[index].runId}: expected sequence ${expected}.`);
    }
  }
}

export function reduceRunSummary(run: ExecutionRun, events: ExecutionEvent[]): RunSummary {
  assertOrdered(events);

  const ordered = sortedBySequence(events);
  let status = run.status;
  let currentPhase: RunSummary['currentPhase'] = null;
  let lastCompletedPhase: RunSummary['lastCompletedPhase'] = null;
  let tasksCompleted = 0;
  let tasksFailed = 0;
  let artifactsProduced = 0;

  for (const event of ordered) {
    currentPhase = event.phase;

    if (event.type === 'PHASE_COMPLETED') {
      lastCompletedPhase = event.phase;
    }
    if (event.type === 'TASK_COMPLETED') {
      tasksCompleted += 1;
      status = 'running';
    }
    if (event.type === 'TASK_FAILED') {
      tasksFailed += 1;
      status = 'running';
    }
    if (event.type === 'NODE_RETRY_SCHEDULED' || event.type === 'NODE_RETRY_STARTED') {
      status = 'running';
    }
    if (event.type === 'NODE_TIMEOUT' || event.type === 'ADAPTER_TIMEOUT') {
      tasksFailed += 1;
      status = 'running';
    }
    if (event.type === 'WORKFLOW_TIMEOUT') {
      status = 'timeout';
    }
    if (event.type === 'WORKFLOW_RECOVERY_STARTED' || event.type === 'WORKFLOW_RECOVERY_RESUMED') {
      status = 'running';
    }
    if (event.type === 'WORKFLOW_CANCELLED') {
      status = 'cancelled';
    }
    if (event.type === 'SAFETY_LIMIT_VIOLATION') {
      status = 'running';
    }
    if (event.type === 'ARTIFACT_RECORDED') {
      artifactsProduced += 1;
      status = 'running';
    }
    if (event.type === 'PHASE_STARTED' || event.type === 'PHASE_COMPLETED' || event.type === 'TASK_STARTED') {
      status = 'running';
    }
    if (event.type === 'RUN_CREATED') {
      status = 'pending';
    }
    if (event.type === 'RUN_COMPLETED') {
      status = 'completed';
    }
    if (event.type === 'RUN_FAILED') {
      status = 'failed';
    }
  }

  return {
    status,
    currentPhase,
    lastCompletedPhase,
    totalEvents: ordered.length,
    tasksCompleted,
    tasksFailed,
    artifactsProduced
  };
}
