import { canonicalStringify } from '../finance/determinism.ts';
import { createPortfolioActionInspection } from '../portfolio-actions/portfolio-action-inspection.ts';

function parseArgs(argv: string[]): { actionId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--action') {
      const actionId = argv[index + 1];
      if (!actionId) {
        throw new Error('MISSING_ARGUMENT: --action');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { actionId };
    }
    if (arg.startsWith('--action=')) {
      const actionId = arg.slice('--action='.length);
      if (!actionId) {
        throw new Error('MISSING_ARGUMENT: --action');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { actionId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --action');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createPortfolioActionInspection();
    printJson(inspection.getPortfolioActionLinks(args.actionId));
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
