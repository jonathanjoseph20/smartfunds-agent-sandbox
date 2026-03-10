import { canonicalStringify } from '../finance/determinism.ts';
import { createSchedulerService } from '../scheduler/service.ts';

function parseArgs(argv: string[]): { scheduleId: string; historyLimit?: number } {
  let scheduleId: string | null = null;
  let historyLimit: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--schedule') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --schedule');
      }
      scheduleId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--schedule=')) {
      const value = arg.slice('--schedule='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --schedule');
      }
      scheduleId = value;
      continue;
    }

    if (arg === '--history-limit') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --history-limit');
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('INVALID_ARGUMENT: --history-limit');
      }
      historyLimit = parsed;
      index += 1;
      continue;
    }

    if (arg.startsWith('--history-limit=')) {
      const value = arg.slice('--history-limit='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('INVALID_ARGUMENT: --history-limit');
      }
      historyLimit = parsed;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!scheduleId) {
    throw new Error('MISSING_ARGUMENT: --schedule');
  }

  return historyLimit ? { scheduleId, historyLimit } : { scheduleId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const scheduler = createSchedulerService();
    const row = scheduler.inspectSchedule({ scheduleId: args.scheduleId, historyLimit: args.historyLimit });
    printJson(row);
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
