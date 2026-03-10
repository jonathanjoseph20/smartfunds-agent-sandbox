import { canonicalStringify } from '../finance/determinism.ts';
import { createInvestigationInspection } from '../investigations/investigation-inspection.ts';

function parseArgs(argv: string[]): { status?: string; triggerId?: string; signalType?: string } {
  let status: string | undefined;
  let triggerId: string | undefined;
  let signalType: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--status') {
      status = argv[index + 1];
      if (!status) {
        throw new Error('MISSING_ARGUMENT: --status');
      }
      index += 1;
      continue;
    }
    if (arg === '--trigger') {
      triggerId = argv[index + 1];
      if (!triggerId) {
        throw new Error('MISSING_ARGUMENT: --trigger');
      }
      index += 1;
      continue;
    }
    if (arg === '--signal-type') {
      signalType = argv[index + 1];
      if (!signalType) {
        throw new Error('MISSING_ARGUMENT: --signal-type');
      }
      index += 1;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  return {
    ...(status ? { status } : {}),
    ...(triggerId ? { triggerId } : {}),
    ...(signalType ? { signalType } : {})
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createInvestigationInspection();
    printJson(inspection.listInvestigations(args));
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
