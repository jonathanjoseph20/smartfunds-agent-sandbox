import { canonicalStringify } from '../finance/determinism.ts';
import { createVentureInspection } from '../ventures/venture-inspection.ts';

const STABLE_ERRORS = new Set([
  'VENTURE_NOT_FOUND',
  'INVALID_VENTURE_DEFINITION',
  'MISSING_ARGUMENT',
  'VENTURE_REGISTRY_EMPTY',
]);

function parseArgs(argv: string[]): { ventureId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--venture') {
      const ventureId = argv[index + 1];
      if (!ventureId) {
        throw new Error('MISSING_ARGUMENT');
      }
      if (index !== argv.length - 2) {
        throw new Error('INVALID_VENTURE_DEFINITION');
      }
      return { ventureId };
    }
    if (arg.startsWith('--venture=')) {
      const ventureId = arg.slice('--venture='.length);
      if (!ventureId) {
        throw new Error('MISSING_ARGUMENT');
      }
      if (argv.length > 1) {
        throw new Error('INVALID_VENTURE_DEFINITION');
      }
      return { ventureId };
    }
    throw new Error('INVALID_VENTURE_DEFINITION');
  }

  throw new Error('MISSING_ARGUMENT');
}

function toStableError(error: unknown): string {
  const message = (error as Error).message ?? 'INVALID_VENTURE_DEFINITION';
  const firstToken = message.split(':')[0]?.trim() ?? '';
  if (STABLE_ERRORS.has(firstToken)) {
    return firstToken;
  }
  return 'INVALID_VENTURE_DEFINITION';
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createVentureInspection();
    printJson(inspection.getVentureStatus(args.ventureId));
    return 0;
  } catch (error) {
    printJson({ error: toStableError(error) });
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
