import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionAttemptInspection } from '../execution-attempt/execution-attempt-inspection.ts';

function parseArgs(argv: string[]): { executionAttemptId: string } {
  let executionAttemptId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--attempt') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --attempt');
      }
      executionAttemptId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--attempt=')) {
      const value = arg.slice('--attempt='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --attempt');
      }
      executionAttemptId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!executionAttemptId) {
    throw new Error('MISSING_ARGUMENT: --attempt');
  }

  return { executionAttemptId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createExecutionAttemptInspection();
    printJson(inspection.executionAttemptStatus(args));
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
    process.stdout.write(`${canonicalStringify({ error: 'unexpected_runtime_error' })}\n`);
    process.exit(2);
  });
}
