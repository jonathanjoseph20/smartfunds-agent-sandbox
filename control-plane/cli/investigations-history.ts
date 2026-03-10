import { canonicalStringify } from '../finance/determinism.ts';
import { createInvestigationInspection } from '../investigations/investigation-inspection.ts';

function parseArgs(argv: string[]): { investigationId?: string } {
  if (argv.length === 0) {
    return {};
  }

  if (argv[0] === '--investigation') {
    const investigationId = argv[1];
    if (!investigationId) {
      throw new Error('MISSING_ARGUMENT: --investigation');
    }
    if (argv.length > 2) {
      throw new Error(`UNKNOWN_ARGUMENT: ${argv[2]}`);
    }
    return { investigationId };
  }

  if (argv[0].startsWith('--investigation=')) {
    const investigationId = argv[0].slice('--investigation='.length);
    if (!investigationId) {
      throw new Error('MISSING_ARGUMENT: --investigation');
    }
    if (argv.length > 1) {
      throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
    }
    return { investigationId };
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createInvestigationInspection();
    if (args.investigationId) {
      printJson(inspection.inspectInvestigation(args.investigationId).history);
      return 0;
    }
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
