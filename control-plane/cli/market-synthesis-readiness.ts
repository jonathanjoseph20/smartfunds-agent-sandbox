import { createMarketInspection } from '../market-synthesis/market-synthesis-inspection.ts';
import { canonicalStringify } from '../finance/determinism.ts';

function parseArgs(argv: string[]): { marketSynthesisId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--market') {
      const marketSynthesisId = argv[index + 1];
      if (!marketSynthesisId) {
        throw new Error('MISSING_ARGUMENT: --market');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { marketSynthesisId };
    }
    if (arg.startsWith('--market=')) {
      const marketSynthesisId = arg.slice('--market='.length);
      if (!marketSynthesisId) {
        throw new Error('MISSING_ARGUMENT: --market');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { marketSynthesisId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --market');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createMarketInspection();
    printJson(inspection.getMarketReadiness(args.marketSynthesisId));
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
