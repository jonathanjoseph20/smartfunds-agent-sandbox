import { canonicalStringify } from '../finance/determinism.ts';
import { createTaskExecutionInspection } from '../task-execution/task-execution-inspection.ts';

function parseArgs(argv: string[]): { taskGraphId: string } {
  let taskGraphId: string | null = null;

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

    throw new Error('TASK_EXECUTION_UNKNOWN_ARGUMENT');
  }

  if (!taskGraphId) {
    throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH');
  }

  return { taskGraphId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createTaskExecutionInspection();
    printJson(inspection.retryTaskExecutionStatus(args));
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
