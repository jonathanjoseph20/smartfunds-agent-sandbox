import { canonicalStringify } from '../finance/determinism.ts';
import { createSynthesisInspection } from '../synthesis/synthesis-inspection.ts';

function parseArgs(argv: string[]): { synthesisId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--synthesis') {
      const synthesisId = argv[index + 1];
      if (!synthesisId) {
        throw new Error('MISSING_ARGUMENT: --synthesis');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { synthesisId };
    }
    if (arg.startsWith('--synthesis=')) {
      const synthesisId = arg.slice('--synthesis='.length);
      if (!synthesisId) {
        throw new Error('MISSING_ARGUMENT: --synthesis');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { synthesisId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --synthesis');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createSynthesisInspection();
    printJson(inspection.inspectStatus(args.synthesisId));
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
