import { canonicalStringify } from '../finance/determinism.ts';
import { createInvestigationScheduler } from '../investigations/investigation-scheduler.ts';

function parseArgs(argv: string[]): { slot: string } {
  let slot: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--slot') {
      slot = argv[index + 1];
      if (!slot) {
        throw new Error('MISSING_ARGUMENT: --slot');
      }
      index += 1;
      continue;
    }

    if (arg.startsWith('--slot=')) {
      slot = arg.slice('--slot='.length);
      if (!slot) {
        throw new Error('MISSING_ARGUMENT: --slot');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!slot) {
    throw new Error('MISSING_ARGUMENT: --slot');
  }

  return { slot };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const scheduler = createInvestigationScheduler();
    printJson(scheduler.listDueInvestigations({ schedulerSlot: args.slot }));
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
