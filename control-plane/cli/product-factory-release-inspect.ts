import { canonicalStringify } from '../finance/determinism.ts';
import { createProductFactoryReleaseInspection } from '../product-factory-release/product-factory-release-inspection.ts';

function parseArgs(argv: string[]): { productFactoryReleaseAcceptanceRecordId: string } {
  if (argv.length === 2 && argv[0] === '--release') {
    return { productFactoryReleaseAcceptanceRecordId: argv[1]! };
  }

  if (argv.length === 1 && argv[0]!.startsWith('--release=')) {
    const productFactoryReleaseAcceptanceRecordId = argv[0]!.slice('--release='.length);
    if (!productFactoryReleaseAcceptanceRecordId) {
      throw new Error('MISSING_ARGUMENT: --release');
    }

    return { productFactoryReleaseAcceptanceRecordId };
  }

  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: --release');
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createProductFactoryReleaseInspection();
    printJson(inspection.inspectReleaseAcceptanceRecord(args.productFactoryReleaseAcceptanceRecordId));
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
