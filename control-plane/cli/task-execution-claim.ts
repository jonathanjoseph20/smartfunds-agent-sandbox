import { canonicalStringify } from '../finance/determinism.ts';
import { createTaskExecutionInspection } from '../task-execution/task-execution-inspection.ts';

function parseArgs(argv: string[]): { taskGraphId: string; taskNodeId: string; workerId: string; claimAttemptIndex: number } {
  let taskGraphId: string | null = null;
  let taskNodeId: string | null = null;
  let workerId: string | null = null;
  let claimAttemptIndex = 0;

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

    if (arg === '--worker') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_WORKER');
      }
      workerId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--worker=')) {
      const value = arg.slice('--worker='.length);
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_WORKER');
      }
      workerId = value;
      continue;
    }

    if (arg === '--claim-attempt') {
      const value = argv[index + 1];
      if (!value || !Number.isInteger(Number(value))) {
        throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_CLAIM_ATTEMPT');
      }
      claimAttemptIndex = Number(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--claim-attempt=')) {
      const value = arg.slice('--claim-attempt='.length);
      if (!value || !Number.isInteger(Number(value))) {
        throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_CLAIM_ATTEMPT');
      }
      claimAttemptIndex = Number(value);
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

  if (!workerId) {
    throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_WORKER');
  }

  return {
    taskGraphId,
    taskNodeId,
    workerId,
    claimAttemptIndex,
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createTaskExecutionInspection().taskExecutionClaim(args));
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
