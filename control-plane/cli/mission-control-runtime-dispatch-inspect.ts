import { canonicalStringify } from '../finance/determinism.ts';
import { createActivationRuntimeIntegrationInspection } from '../mission-control/activation-runtime-integration-inspection.ts';

function parseArgs(argv: string[]): { activationDispatchAttemptId: string } {
  let activationDispatchAttemptId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--attempt' || arg === '--attemptId') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --attempt');
      }
      activationDispatchAttemptId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--attempt=')) {
      const value = arg.slice('--attempt='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --attempt');
      }
      activationDispatchAttemptId = value;
      continue;
    }

    if (arg.startsWith('--attemptId=')) {
      const value = arg.slice('--attemptId='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --attempt');
      }
      activationDispatchAttemptId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!activationDispatchAttemptId) {
    throw new Error('MISSING_ARGUMENT: --attempt');
  }

  return { activationDispatchAttemptId };
}

function toStableError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown_error';
  return message === 'ACTIVATION_DISPATCH_ATTEMPT_NOT_FOUND'
    ? 'activation_dispatch_attempt_not_found'
    : message;
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const result = createActivationRuntimeIntegrationInspection().inspectDispatchAttempt(args);
    printJson(result);
    return 0;
  } catch (error) {
    printJson({ error: toStableError(error) });
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_CONTROL_RUNTIME_DISPATCH_INSPECT_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
