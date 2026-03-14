import { canonicalStringify } from '../finance/determinism.ts';
import { createCommerceInspection } from '../commerce/commerce-inspection.ts';

function parseArgs(argv: string[]): { chargeIntentId: string } {
  if (argv.length === 2 && argv[0] === '--intent') {
    return { chargeIntentId: argv[1]! };
  }

  if (argv.length === 1 && argv[0]!.startsWith('--intent=')) {
    const chargeIntentId = argv[0]!.slice('--intent='.length);
    if (!chargeIntentId) {
      throw new Error('MISSING_ARGUMENT: --intent');
    }

    return { chargeIntentId };
  }

  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: --intent');
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createCommerceInspection();
    printJson(inspection.inspectSettlementLogs(args.chargeIntentId));
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
