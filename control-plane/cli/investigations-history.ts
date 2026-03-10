import { canonicalStringify } from '../finance/determinism.ts';
import { createInvestigationInspection } from '../investigations/investigation-inspection.ts';

function parseArgs(argv: string[]): void {
  if (argv.length > 0) {
    throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
  }
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    parseArgs(argv);
    const inspection = createInvestigationInspection();
    printJson(inspection.historyByDate());
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
