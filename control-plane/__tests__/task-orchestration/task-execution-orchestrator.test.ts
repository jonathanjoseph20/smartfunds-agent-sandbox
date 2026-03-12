import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskExecutionOrchestrator } from '../../task-execution/task-execution-orchestrator.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-orchestrator');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task execution orchestrator', () => {
  it('T-MTO-O1 cycle creates deterministic assignments and deferrals', () => {
    const orchestrator = createTaskExecutionOrchestrator({
      projection: {
        projectOne: () => ({
          executionEngineRunId: 'er-1',
          taskGraphId: 'tg-1',
          currentWaveNodeIds: ['node-a', 'node-b'],
          deferredNodeIds: [],
          retryAttempts: [{ taskNodeId: 'node-b', attemptIndex: 1 }],
          runningNodeCount: 0,
        }),
      } as never,
      taskGraphProjection: {
        projectOne: () => ({
          taskNodes: [
            {
              taskNodeId: 'node-a',
              taskGraphId: 'tg-1',
              taskType: 'shell',
              taskName: 'node-a',
              taskDescription: 'node-a',
              taskInputs: {},
              taskOutputs: {},
              requiredCapabilities: ['filesystem'],
              taskState: 'ready',
              taskEligibilityState: 'eligible',
              blockingReasons: [],
              limitations: [],
              provenanceInputs: {},
            },
            {
              taskNodeId: 'node-b',
              taskGraphId: 'tg-1',
              taskType: 'shell',
              taskName: 'node-b',
              taskDescription: 'node-b',
              taskInputs: {},
              taskOutputs: {},
              requiredCapabilities: ['filesystem'],
              taskState: 'ready',
              taskEligibilityState: 'eligible',
              blockingReasons: [],
              limitations: [],
              provenanceInputs: {},
            },
          ],
          taskEdges: [],
        }),
      } as never,
      workerRegistry: {
        listWorkers: () => [{
          workerId: 'worker-a',
          workerType: 'local',
          supportedTaskTypes: ['shell'],
          capabilities: ['filesystem'],
          status: 'active',
          maxConcurrentAssignments: 1,
        }],
      } as never,
      taskExecutionArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const first = orchestrator.cycle({ taskGraphId: 'tg-1' });
    const second = orchestrator.cycle({ taskGraphId: 'tg-1' });

    expect(first.assignments.length).toBe(2);
    expect(first.assignments.filter((assignment) => assignment.assignmentState === 'assigned')).toHaveLength(1);
    expect(first.assignments.filter((assignment) => assignment.assignmentState !== 'assigned')).toHaveLength(1);
    expect(second.cycle.cycleIndex).toBe(first.cycle.cycleIndex + 1);
  });
});
