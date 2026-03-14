import { canonicalStringify } from '../finance/determinism.ts';
import { createRepoScaffoldInspection } from '../repo-scaffold/repo-scaffold-inspection.ts';

function parseArgs(argv: string[]): { bundleId: string } {
  if (argv.length === 2 && argv[0] === '--bundle') {
    return { bundleId: argv[1]! };
  }

  if (argv.length === 1 && argv[0]!.startsWith('--bundle=')) {
    const bundleId = argv[0]!.slice('--bundle='.length);
    if (!bundleId) {
      throw new Error('MISSING_ARGUMENT: --bundle');
    }

    return { bundleId };
  }

  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: --bundle');
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createRepoScaffoldInspection();
    printJson(inspection.materializeRepoScaffoldBundle({ bundleId: args.bundleId }));
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
