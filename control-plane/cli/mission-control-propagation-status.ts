import { canonicalStringify } from '../finance/determinism.ts';
import { createRuntimeOutcomePropagationInspection } from '../mission-control/runtime-outcome-propagation-inspection.ts';

function parseArgs(argv: string[]): { runtimeOutcomePropagationRecordId: string } {
  let runtimeOutcomePropagationRecordId: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--record') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --record');
      }
      runtimeOutcomePropagationRecordId = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--record=')) {
      const value = arg.slice('--record='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --record');
      }
      runtimeOutcomePropagationRecordId = value;
      continue;
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }
  if (!runtimeOutcomePropagationRecordId) {
    throw new Error('MISSING_ARGUMENT: --record');
  }
  return { runtimeOutcomePropagationRecordId };
}

function toStableError(error: unknown): string {
  return (error as Error).message === 'RUNTIME_OUTCOME_PROPAGATION_RECORD_NOT_FOUND'
    ? 'runtime_outcome_propagation_record_not_found'
    : (error as Error).message;
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createRuntimeOutcomePropagationInspection().inspectPropagationOutcome(args));
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
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_CONTROL_PROPAGATION_STATUS_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
