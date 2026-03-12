import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionAttemptInspection } from '../execution-attempt/execution-attempt-inspection.ts';

function parseArgs(argv: string[]): {
  runtimeEnvelopeId: string;
  attemptIndex?: number;
  executionAttemptPolicyId?: string;
} {
  let runtimeEnvelopeId: string | null = null;
  let attemptIndex: number | undefined;
  let executionAttemptPolicyId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    const consume = (flag: string): string => {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`MISSING_ARGUMENT: ${flag}`);
      }
      index += 1;
      return value;
    };

    if (arg === '--envelope') {
      runtimeEnvelopeId = consume('--envelope');
      continue;
    }
    if (arg.startsWith('--envelope=')) {
      runtimeEnvelopeId = arg.slice('--envelope='.length);
      if (!runtimeEnvelopeId) {
        throw new Error('MISSING_ARGUMENT: --envelope');
      }
      continue;
    }

    if (arg === '--attempt-index') {
      const rawValue = consume('--attempt-index');
      attemptIndex = Number.parseInt(rawValue, 10);
      if (!Number.isInteger(attemptIndex) || attemptIndex < 1) {
        throw new Error('INVALID_ARGUMENT: --attempt-index');
      }
      continue;
    }
    if (arg.startsWith('--attempt-index=')) {
      const rawValue = arg.slice('--attempt-index='.length);
      if (!rawValue) {
        throw new Error('MISSING_ARGUMENT: --attempt-index');
      }
      attemptIndex = Number.parseInt(rawValue, 10);
      if (!Number.isInteger(attemptIndex) || attemptIndex < 1) {
        throw new Error('INVALID_ARGUMENT: --attempt-index');
      }
      continue;
    }

    if (arg === '--policy') {
      executionAttemptPolicyId = consume('--policy');
      continue;
    }
    if (arg.startsWith('--policy=')) {
      executionAttemptPolicyId = arg.slice('--policy='.length);
      if (!executionAttemptPolicyId) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!runtimeEnvelopeId) {
    throw new Error('MISSING_ARGUMENT: --envelope');
  }

  return {
    runtimeEnvelopeId,
    ...(typeof attemptIndex === 'number' ? { attemptIndex } : {}),
    ...(executionAttemptPolicyId ? { executionAttemptPolicyId } : {}),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createExecutionAttemptInspection();
    printJson(inspection.createExecutionAttempt(args));
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
