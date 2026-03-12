import { canonicalStringify } from '../finance/determinism.ts';
import { createTaskExecutionInspection } from '../task-execution/task-execution-inspection.ts';

function parseArgs(argv: string[]): {
  taskGraphId: string;
  taskNodeId: string;
  failureCode?: string;
  failureClass?: 'RETRYABLE_FAILURE' | 'NON_RETRYABLE_FAILURE' | 'SYSTEM_FAILURE' | 'POLICY_FAILURE' | 'DEPENDENCY_FAILURE';
} {
  let taskGraphId: string | null = null;
  let taskNodeId: string | null = null;
  let failureCode: string | undefined;
  let failureClass: 'RETRYABLE_FAILURE' | 'NON_RETRYABLE_FAILURE' | 'SYSTEM_FAILURE' | 'POLICY_FAILURE' | 'DEPENDENCY_FAILURE' | undefined;

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

    if (arg === '--failure-code') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_FAILURE_CODE');
      }
      failureCode = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--failure-code=')) {
      const value = arg.slice('--failure-code='.length);
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_FAILURE_CODE');
      }
      failureCode = value;
      continue;
    }

    if (arg === '--failure-class') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_FAILURE_CLASS');
      }
      failureClass = value as typeof failureClass;
      index += 1;
      continue;
    }

    if (arg.startsWith('--failure-class=')) {
      const value = arg.slice('--failure-class='.length);
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_FAILURE_CLASS');
      }
      failureClass = value as typeof failureClass;
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

  return {
    taskGraphId,
    taskNodeId,
    ...(failureCode ? { failureCode } : {}),
    ...(failureClass ? { failureClass } : {}),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createTaskExecutionInspection();
    const result = inspection.failTaskNode(args);
    printJson({
      taskGraphId: args.taskGraphId,
      taskNodeId: args.taskNodeId,
      nodeState: result.projection.nodeStates[args.taskNodeId],
      failureClass: result.failureClass,
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
