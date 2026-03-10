import { canonicalStringify } from '../finance/determinism.ts';
import { createInvestigationInspection } from '../investigations/investigation-inspection.ts';

function parseArgs(argv: string[]): { investigationId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--investigation') {
      const investigationId = argv[index + 1];
      if (!investigationId) {
        throw new Error('MISSING_ARGUMENT: --investigation');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { investigationId };
    }
    if (arg.startsWith('--investigation=')) {
      const investigationId = arg.slice('--investigation='.length);
      if (!investigationId) {
        throw new Error('MISSING_ARGUMENT: --investigation');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { investigationId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --investigation');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createInvestigationInspection();
    printJson(inspection.listEvidence(args.investigationId));
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
