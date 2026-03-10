import { canonicalStringify } from '../finance/determinism.ts';
import { createResearchInspection } from '../research/inspection.ts';

function parseArgs(argv: string[]): { packId: string } {
  let packId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--pack') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --pack');
      }
      packId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--pack=')) {
      packId = arg.slice('--pack='.length);
      if (!packId) {
        throw new Error('MISSING_ARGUMENT: --pack');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!packId) {
    throw new Error('MISSING_ARGUMENT: --pack');
  }

  return { packId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createResearchInspection();
    printJson(inspection.showPack(args.packId));
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
