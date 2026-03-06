import { createExecutionJournal, type ExecutionJournal } from '../journal/journal.ts';
import type { ExecutionEvent, ExecutionRun, RunKind } from '../journal/types.ts';
import { getOrderedPhases } from './phase-engine.ts';
import { executePhaseTasks } from './task-executor.ts';
import {
  SWARM_PHASES,
  type SwarmPhase,
  type SwarmRunSummary,
  type SwarmRunRecord,
  type SwarmTaskDefinition,
  type SwarmTaskExecutor,
  isSwarmPhase
} from './swarm-types.ts';

type CreateSwarmRunInput = {
  projectId: string;
  kind?: RunKind;
  entrypoint?: string;
};

type ExecuteSwarmRunInput = {
  runId: string;
};

type GetSwarmRunStatusInput = {
  runId: string;
};

type SwarmRunnerOptions = {
  rootDir?: string;
  journal?: ExecutionJournal;
  taskExecutors?: Partial<Record<string, SwarmTaskExecutor>>;
};

type TaskTemplate = {
  taskId: string;
  phase: SwarmPhase;
  description: string;
  order: number;
  type: 'llm' | 'shell' | 'repo';
  inputs: Record<string, unknown>;
  executorKey?: string;
};

const TASK_TEMPLATES: readonly TaskTemplate[] = [
  {
    taskId: 'validate-project-context',
    phase: 'plan',
    description: 'Validate canonical project context',
    order: 1,
    type: 'repo',
    inputs: {
      operation: 'list_dir',
      path: 'control-plane'
    },
    executorKey: 'validate-project-context'
  },
  {
    taskId: 'load-run-context',
    phase: 'setup',
    description: 'Load deterministic run context',
    order: 1,
    type: 'llm',
    inputs: {
      prompt: 'Load deterministic run context'
    },
    executorKey: 'load-run-context'
  },
  {
    taskId: 'execute-work-unit',
    phase: 'implement',
    description: 'Execute deterministic work unit',
    order: 1,
    type: 'repo',
    inputs: {
      operation: 'list_dir',
      path: 'control-plane/swarm'
    },
    executorKey: 'execute-work-unit'
  },
  {
    taskId: 'verify-phase-output',
    phase: 'verify',
    description: 'Verify phase output deterministically',
    order: 1,
    type: 'shell',
    inputs: {
      command: 'printf',
      args: ['verify-phase-output\n']
    },
    executorKey: 'verify-phase-output'
  },
  {
    taskId: 'run-phase-checks',
    phase: 'test',
    description: 'Run deterministic phase checks',
    order: 1,
    type: 'llm',
    inputs: {
      prompt: 'Run deterministic phase checks'
    },
    executorKey: 'run-phase-checks'
  },
  {
    taskId: 'finalize-run',
    phase: 'release',
    description: 'Finalize run outputs',
    order: 1,
    type: 'repo',
    inputs: {
      operation: 'list_dir',
      path: '.'
    },
    executorKey: 'finalize-run'
  }
] as const;

function buildTaskDefinitions(
  taskExecutors: Partial<Record<string, SwarmTaskExecutor>>
): Record<SwarmPhase, SwarmTaskDefinition[]> {
  const byPhase: Record<SwarmPhase, SwarmTaskDefinition[]> = {
    plan: [],
    setup: [],
    implement: [],
    verify: [],
    test: [],
    release: []
  };

  for (const task of TASK_TEMPLATES) {
    const executor = task.executorKey ? taskExecutors[task.executorKey] : undefined;
    byPhase[task.phase].push({
      taskId: task.taskId,
      phase: task.phase,
      description: task.description,
      type: task.type,
      inputs: task.inputs,
      executionContext: {},
      ...(executor ? { executor } : {}),
      order: task.order
    });
  }

  for (const phase of SWARM_PHASES) {
    byPhase[phase] = [...byPhase[phase]].sort((left, right) => {
      const orderCmp = left.order - right.order;
      if (orderCmp !== 0) {
        return orderCmp;
      }
      return left.taskId.localeCompare(right.taskId);
    });
  }

  return byPhase;
}

function deriveSwarmRunSummary(
  run: SwarmRunRecord,
  events: ExecutionEvent[],
  tasksByPhase: Record<SwarmPhase, SwarmTaskDefinition[]>
): SwarmRunSummary {
  const orderedEvents = [...events].sort((left, right) => left.sequence - right.sequence);
  const phaseStatus = new Map<SwarmPhase, 'pending' | 'running' | 'completed' | 'failed'>(
    SWARM_PHASES.map((phase) => [phase, 'pending'])
  );
  const taskStatus = new Map<string, 'pending' | 'running' | 'completed' | 'failed'>();

  for (const phase of SWARM_PHASES) {
    for (const task of tasksByPhase[phase]) {
      taskStatus.set(task.taskId, 'pending');
    }
  }

  let status: SwarmRunSummary['status'] = 'created';
  let currentPhase: SwarmPhase | null = null;
  let failedPhase: SwarmPhase | undefined;
  const completedPhaseSet = new Set<SwarmPhase>();

  for (const event of orderedEvents) {
    if (!isSwarmPhase(event.phase)) {
      continue;
    }

    currentPhase = event.phase;

    if (event.type === 'RUN_CREATED') {
      status = 'created';
      continue;
    }

    if (event.type === 'PHASE_STARTED') {
      status = 'running';
      phaseStatus.set(event.phase, 'running');
      continue;
    }

    if (event.type === 'TASK_STARTED' && event.taskId) {
      status = 'running';
      taskStatus.set(event.taskId, 'running');
      continue;
    }

    if (event.type === 'TASK_COMPLETED' && event.taskId) {
      status = 'running';
      taskStatus.set(event.taskId, 'completed');
      continue;
    }

    if (event.type === 'TASK_FAILED' && event.taskId) {
      status = 'failed';
      failedPhase = event.phase;
      phaseStatus.set(event.phase, 'failed');
      taskStatus.set(event.taskId, 'failed');
      continue;
    }

    if (event.type === 'PHASE_COMPLETED') {
      phaseStatus.set(event.phase, 'completed');
      completedPhaseSet.add(event.phase);
      if (status !== 'failed') {
        status = 'running';
      }
      continue;
    }

    if (event.type === 'RUN_FAILED') {
      status = 'failed';
      failedPhase = event.phase;
      phaseStatus.set(event.phase, 'failed');
      continue;
    }

    if (event.type === 'RUN_COMPLETED') {
      status = 'completed';
    }
  }

  const completedPhases = SWARM_PHASES.filter((phase) => completedPhaseSet.has(phase));

  const phaseSummaries = SWARM_PHASES.map((phase) => ({
    phase,
    status: phaseStatus.get(phase) ?? 'pending'
  }));

  const taskSummaries = SWARM_PHASES.flatMap((phase) => {
    const tasks = [...tasksByPhase[phase]].sort((left, right) => {
      const orderCmp = left.order - right.order;
      if (orderCmp !== 0) {
        return orderCmp;
      }
      return left.taskId.localeCompare(right.taskId);
    });

    return tasks.map((task) => ({
      taskId: task.taskId,
      phase,
      status: taskStatus.get(task.taskId) ?? 'pending',
      order: task.order,
      description: task.description
    }));
  });

  return {
    runId: run.runId,
    projectId: run.projectId,
    entity: run.entity,
    pod: run.pod,
    mode: run.mode,
    kind: run.kind,
    status,
    currentPhase,
    completedPhases,
    ...(failedPhase ? { failedPhase } : {}),
    phaseSummaries,
    taskSummaries,
    eventCount: orderedEvents.length
  };
}

export function createSwarmRunner(options: SwarmRunnerOptions = {}) {
  const journal = options.journal ?? createExecutionJournal({ rootDir: options.rootDir });
  const tasksByPhase = buildTaskDefinitions(options.taskExecutors ?? {});

  function deriveRunSummary(runId: string): SwarmRunSummary {
    const inspected = journal.inspectRun(runId);

    return deriveSwarmRunSummary(
      {
        runId: inspected.run.runId,
        projectId: inspected.run.projectId,
        entity: inspected.run.entity,
        pod: inspected.run.pod,
        mode: inspected.run.mode,
        kind: inspected.run.kind
      },
      inspected.events,
      tasksByPhase
    );
  }

  function createSwarmRun(input: CreateSwarmRunInput): SwarmRunSummary {
    const kind = input.kind ?? 'swarm';
    const entrypoint = input.entrypoint ?? 'swarm:default';

    const run = journal.createRun({
      projectId: input.projectId,
      kind,
      entrypoint
    });

    journal.appendEvent({
      runId: run.runId,
      type: 'RUN_CREATED',
      phase: 'plan',
      payload: {
        kind,
        entrypoint
      }
    });

    return deriveRunSummary(run.runId);
  }

  async function executeSwarmRun(input: ExecuteSwarmRunInput): Promise<SwarmRunSummary> {
    const initialSummary = deriveRunSummary(input.runId);
    if (initialSummary.status === 'completed' || initialSummary.status === 'failed') {
      return initialSummary;
    }

    const completedPhaseSet = new Set(initialSummary.completedPhases);

    for (const phase of getOrderedPhases()) {
      if (completedPhaseSet.has(phase)) {
        continue;
      }

      journal.appendEvent({
        runId: input.runId,
        type: 'PHASE_STARTED',
        phase,
        payload: {}
      });

      const result = await executePhaseTasks({
        runId: input.runId,
        phase,
        tasks: tasksByPhase[phase],
        emitEvent: (event) => {
          journal.appendEvent({
            runId: input.runId,
            type: event.type,
            phase: event.phase,
            taskId: event.taskId,
            payload: event.payload ?? {}
          });
        }
      });

      if (result.status === 'failed') {
        journal.appendEvent({
          runId: input.runId,
          type: 'RUN_FAILED',
          phase,
          taskId: result.failedTaskId,
          payload: {
            failedTaskId: result.failedTaskId ?? null
          }
        });
        return deriveRunSummary(input.runId);
      }

      journal.appendEvent({
        runId: input.runId,
        type: 'PHASE_COMPLETED',
        phase,
        payload: {}
      });
    }

    journal.appendEvent({
      runId: input.runId,
      type: 'RUN_COMPLETED',
      phase: 'release',
      payload: {}
    });

    return deriveRunSummary(input.runId);
  }

  function getSwarmRunStatus(input: GetSwarmRunStatusInput): SwarmRunSummary {
    return deriveRunSummary(input.runId);
  }

  return {
    createSwarmRun,
    executeSwarmRun,
    getSwarmRunStatus
  };
}

export type SwarmRunner = ReturnType<typeof createSwarmRunner>;
