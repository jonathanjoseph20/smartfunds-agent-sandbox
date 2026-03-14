import { canonicalStringify } from '../finance/determinism.ts';
import { createBuildEvidenceInspection } from '../build-evidence/build-evidence-inspection.ts';

function parseArgs(argv: string[]): { buildEvidenceBundleId: string } {
  if (argv.length === 2 && argv[0] === '--evidence') {
    return { buildEvidenceBundleId: argv[1]! };
  }

  if (argv.length === 1 && argv[0]!.startsWith('--evidence=')) {
    const buildEvidenceBundleId = argv[0]!.slice('--evidence='.length);
    if (!buildEvidenceBundleId) {
      throw new Error('MISSING_ARGUMENT: --evidence');
    }

    return { buildEvidenceBundleId };
  }

  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: --evidence');
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createBuildEvidenceInspection();
    printJson(inspection.inspectEvidenceHistory(args.buildEvidenceBundleId));
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
