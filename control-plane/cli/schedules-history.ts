import { canonicalStringify } from '../finance/determinism.ts';
import { createSchedulerService } from '../scheduler/service.ts';

function parseArgs(argv: string[]): { scheduleId?: string; limit?: number } {
  let scheduleId: string | undefined;
  let limit: number | undefined;

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

    if (arg === '--limit') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --limit');
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('INVALID_ARGUMENT: --limit');
      }
      limit = parsed;
      index += 1;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = arg.slice('--limit='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('INVALID_ARGUMENT: --limit');
      }
      limit = parsed;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  return {
    ...(scheduleId ? { scheduleId } : {}),
    ...(limit ? { limit } : {})
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const scheduler = createSchedulerService();
    const history = scheduler.listHistory(args);
    printJson(history);
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
