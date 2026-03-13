import { canonicalStringify } from '../finance/determinism.ts';
import { createVentureInspection } from '../ventures/venture-inspection.ts';

const STABLE_ERRORS = new Set([
  'VENTURE_NOT_FOUND',
  'INVALID_VENTURE_DEFINITION',
  'MISSING_ARGUMENT',
  'VENTURE_REGISTRY_EMPTY',
]);

function parseArgs(argv: string[]): Record<string, never> {
  if (argv.length > 0) {
    throw new Error('INVALID_VENTURE_DEFINITION');
  }
  return {};
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
    parseArgs(argv);
    const inspection = createVentureInspection();
    printJson(inspection.listVentures());
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
