import { canonicalStringify } from '../finance/determinism.ts';
import { createSignalInspection } from '../signals/signal-inspection.ts';

function parseArgs(argv: string[]): { signalType: string } {
  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: <signalType>');
  }

  const [signalType, ...rest] = argv;
  if (!signalType || signalType.startsWith('--')) {
    throw new Error('MISSING_ARGUMENT: <signalType>');
  }
  if (rest.length > 0) {
    throw new Error(`UNKNOWN_ARGUMENT: ${rest[0]}`);
  }

  return { signalType };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createSignalInspection();
    printJson(inspection.inspectSignalType(args.signalType));
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
