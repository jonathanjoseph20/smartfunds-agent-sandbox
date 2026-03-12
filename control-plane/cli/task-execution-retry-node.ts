import { canonicalStringify } from '../finance/determinism.ts';
import { createTaskExecutionInspection } from '../task-execution/task-execution-inspection.ts';

function parseArgs(argv: string[]): { taskGraphId: string; taskNodeId: string } {
  let taskGraphId: string | null = null;
  let taskNodeId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--graph') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH');
      }
      taskGraphId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--graph=')) {
      const value = arg.slice('--graph='.length);
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH');
      }
      taskGraphId = value;
      continue;
    }

    if (arg === '--node') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_NODE');
      }
      taskNodeId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--node=')) {
      const value = arg.slice('--node='.length);
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_NODE');
      }
      taskNodeId = value;
      continue;
    }

    throw new Error('TASK_EXECUTION_UNKNOWN_ARGUMENT');
  }

  if (!taskGraphId) {
    throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH');
  }

  if (!taskNodeId) {
    throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_NODE');
  }

  return { taskGraphId, taskNodeId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createTaskExecutionInspection();
    const result = inspection.retryTaskNode(args);
    printJson({
      taskGraphId: args.taskGraphId,
      taskNodeId: args.taskNodeId,
      retryScheduled: result.retryScheduled,
      retryStarted: 'retryStarted' in result ? result.retryStarted : false,
      nodeState: result.projection.nodeStates[args.taskNodeId],
      graphState: result.projection.graphState,
    });
    return 0;
  } catch (error) {
    printJson({ error: (error as Error).message });
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write(`${canonicalStringify({ error: 'TASK_EXECUTION_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
