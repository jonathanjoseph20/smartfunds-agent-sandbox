import { canonicalStringify } from '../finance/determinism.ts';
import { createActivationRuntimeIntegrationManager } from '../mission-control/activation-runtime-integration-manager.ts';

function parseArgs(argv: string[]): { activationDispatchAttemptId: string } {
  let activationDispatchAttemptId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--attempt') {
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

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!activationDispatchAttemptId) {
    throw new Error('MISSING_ARGUMENT: --attempt');
  }

  return { activationDispatchAttemptId };
}

function toStableError(error: unknown): string {
  return (error as Error).message === 'ACTIVATION_DISPATCH_ATTEMPT_NOT_FOUND'
    ? 'activation_dispatch_attempt_not_found'
    : (error as Error).message;
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const result = createActivationRuntimeIntegrationManager().deferDispatchAttempt(args);
    printJson(result.statusPreview);
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
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_CONTROL_RUNTIME_DEFER_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
