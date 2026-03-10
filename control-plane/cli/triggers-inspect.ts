import { canonicalStringify } from '../finance/determinism.ts';
import { createTriggerInspection } from '../triggers/trigger-inspection.ts';

function parseArgs(argv: string[]): { triggerId: string } {
  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: <triggerId>');
  }

  const [triggerId, ...rest] = argv;
  if (!triggerId || triggerId.startsWith('--')) {
    throw new Error('MISSING_ARGUMENT: <triggerId>');
  }
  if (rest.length > 0) {
    throw new Error(`UNKNOWN_ARGUMENT: ${rest[0]}`);
  }

  return { triggerId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createTriggerInspection();
    printJson(inspection.inspectTrigger(args.triggerId));
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
