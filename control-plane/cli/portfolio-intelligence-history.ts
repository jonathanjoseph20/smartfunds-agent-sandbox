import { canonicalStringify } from '../finance/determinism.ts';
import { createPortfolioInspection } from '../portfolio-intelligence/portfolio-inspection.ts';

function parseArgs(argv: string[]): { portfolioId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--portfolio') {
      const portfolioId = argv[index + 1];
      if (!portfolioId) {
        throw new Error('MISSING_ARGUMENT: --portfolio');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { portfolioId };
    }
    if (arg.startsWith('--portfolio=')) {
      const portfolioId = arg.slice('--portfolio='.length);
      if (!portfolioId) {
        throw new Error('MISSING_ARGUMENT: --portfolio');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { portfolioId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --portfolio');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createPortfolioInspection();
    printJson(inspection.getPortfolioHistory(args.portfolioId));
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
