import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionEngineInspection } from '../execution-engine/execution-engine-inspection.ts';

function parseArgs(argv: string[]): { executionAttemptId: string; enginePolicyId?: string } {
  let executionAttemptId: string | null = null;
  let enginePolicyId: string | undefined;

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

    if (arg === '--policy') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      enginePolicyId = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--policy=')) {
      const value = arg.slice('--policy='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      enginePolicyId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!executionAttemptId) {
    throw new Error('MISSING_ARGUMENT: --attempt');
  }

  return {
    executionAttemptId,
    ...(enginePolicyId ? { enginePolicyId } : {}),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createExecutionEngineInspection();
    printJson(inspection.materializeEngineRun(args));
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
