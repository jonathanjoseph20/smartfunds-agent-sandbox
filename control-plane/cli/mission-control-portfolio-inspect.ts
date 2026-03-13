import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionPortfolioInspection } from '../mission-control/mission-portfolio-inspection.ts';

function parseArgs(argv: string[]): { missionPortfolioId: string } {
  let missionPortfolioId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--portfolio') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --portfolio');
      }
      missionPortfolioId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--portfolio=')) {
      const value = arg.slice('--portfolio='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --portfolio');
      }
      missionPortfolioId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!missionPortfolioId) {
    throw new Error('MISSING_ARGUMENT: --portfolio');
  }

  return { missionPortfolioId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createMissionPortfolioInspection().inspectMissionPortfolio(args));
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
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_PORTFOLIO_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
