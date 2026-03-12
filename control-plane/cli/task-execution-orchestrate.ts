import { canonicalStringify } from '../finance/determinism.ts';
import { createTaskExecutionInspection } from '../task-execution/task-execution-inspection.ts';

function parseArgs(argv: string[]): { taskGraphId: string; workerSchedulingPolicyId?: string; maxCycles?: number } {
  let taskGraphId: string | null = null;
  let workerSchedulingPolicyId: string | null = null;
  let maxCycles: number | null = null;

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

    if (arg === '--policy') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_POLICY');
      }
      workerSchedulingPolicyId = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--policy=')) {
      const value = arg.slice('--policy='.length);
      if (!value) {
        throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_POLICY');
      }
      workerSchedulingPolicyId = value;
      continue;
    }

    if (arg === '--max-cycles') {
      const value = argv[index + 1];
      if (!value || !Number.isInteger(Number(value)) || Number(value) <= 0) {
        throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_MAX_CYCLES');
      }
      maxCycles = Number(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-cycles=')) {
      const value = arg.slice('--max-cycles='.length);
      if (!value || !Number.isInteger(Number(value)) || Number(value) <= 0) {
        throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_MAX_CYCLES');
      }
      maxCycles = Number(value);
      continue;
    }

    throw new Error('TASK_EXECUTION_UNKNOWN_ARGUMENT');
  }

  if (!taskGraphId) {
    throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH');
  }

  return {
    taskGraphId,
    ...(workerSchedulingPolicyId ? { workerSchedulingPolicyId } : {}),
    ...(maxCycles !== null ? { maxCycles } : {}),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createTaskExecutionInspection().taskExecutionOrchestrate(args));
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
