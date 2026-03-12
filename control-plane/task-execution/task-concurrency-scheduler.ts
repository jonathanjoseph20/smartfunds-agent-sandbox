import type { MissionTaskExecutionProjection } from './task-execution-step-types.ts';

import type { TaskConcurrencyPolicy } from './task-concurrency-policy-types.ts';
import type { RunnableNodeSet } from './task-runnable-node-set.ts';
import type { TaskSchedulingWave } from './task-scheduling-wave-types.ts';
import { buildSchedulingWave } from './task-scheduling-wave.ts';

export function computeSchedulingWave(
  runnableSet: RunnableNodeSet,
  policy: TaskConcurrencyPolicy,
  projection: MissionTaskExecutionProjection,
): TaskSchedulingWave {
  return buildSchedulingWave({
    runnableSet,
    policy,
    projection,
  });
}
