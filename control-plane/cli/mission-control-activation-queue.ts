import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionExecutionActivationInspection } from '../mission-control/mission-execution-activation-inspection.ts';

function parseArgs(argv: string[]): { executionActivationRecordId?: string } {
  let executionActivationRecordId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--activation') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --activation');
      }
      executionActivationRecordId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--activation=')) {
      const value = arg.slice('--activation='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --activation');
      }
      executionActivationRecordId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  return { executionActivationRecordId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

function toStableError(error: unknown): string {
  return (error as Error).message === 'EXECUTION_ACTIVATION_RECORD_NOT_FOUND'
    ? 'execution_activation_record_not_found'
    : (error as Error).message;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createMissionExecutionActivationInspection();

    if (args.executionActivationRecordId) {
      printJson(inspection.inspectActivationQueue({ executionActivationRecordId: args.executionActivationRecordId }));
      return 0;
    }

    printJson(inspection.listActivationRecords().map((entry) => ({
      executionActivationRecordId: entry.executionActivationRecordId,
      queueState: entry.queueState,
      priority: entry.priority,
    })));
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
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_CONTROL_ACTIVATION_QUEUE_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
