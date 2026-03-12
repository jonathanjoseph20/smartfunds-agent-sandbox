import { canonicalStringify } from '../finance/determinism.ts';
import { createTaskExecutionInspection } from '../task-execution/task-execution-inspection.ts';

function parseArgs(argv: string[]): { workerId: string } {
  let workerId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--worker') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('WORKERS_ARGUMENT_MISSING_WORKER');
      }
      workerId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--worker=')) {
      const value = arg.slice('--worker='.length);
      if (!value) {
        throw new Error('WORKERS_ARGUMENT_MISSING_WORKER');
      }
      workerId = value;
      continue;
    }

    throw new Error('WORKERS_UNKNOWN_ARGUMENT');
  }

  if (!workerId) {
    throw new Error('WORKERS_ARGUMENT_MISSING_WORKER');
  }

  return { workerId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createTaskExecutionInspection().workersInspect(args));
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
    process.stdout.write(`${canonicalStringify({ error: 'WORKERS_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
