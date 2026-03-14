import { canonicalStringify } from '../finance/determinism.ts';
import { createProductFactoryReleaseInspection } from '../product-factory-release/product-factory-release-inspection.ts';

function parseDocs(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function parseArgs(argv: string[]): { releaseTrack: string; chargeIntentId: string; presentDocumentIds: string[] } {
  let releaseTrack: string | null = null;
  let chargeIntentId: string | null = null;
  let presentDocumentIds: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;

    if (token === '--track') {
      releaseTrack = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (token.startsWith('--track=')) {
      releaseTrack = token.slice('--track='.length);
      continue;
    }

    if (token === '--intent') {
      chargeIntentId = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (token.startsWith('--intent=')) {
      chargeIntentId = token.slice('--intent='.length);
      continue;
    }

    if (token === '--docs') {
      presentDocumentIds = parseDocs(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (token.startsWith('--docs=')) {
      presentDocumentIds = parseDocs(token.slice('--docs='.length));
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${token}`);
  }

  if (!releaseTrack) {
    throw new Error('MISSING_ARGUMENT: --track');
  }

  if (!chargeIntentId) {
    throw new Error('MISSING_ARGUMENT: --intent');
  }

  return {
    releaseTrack,
    chargeIntentId,
    presentDocumentIds,
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createProductFactoryReleaseInspection();
    printJson(inspection.createReleaseAcceptance({
      releaseTrack: args.releaseTrack,
      chargeIntentId: args.chargeIntentId,
      presentDocumentIds: args.presentDocumentIds,
    }));
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
