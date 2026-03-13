import { canonicalStringify } from '../finance/determinism.ts';
import { createCrossPortfolioMissionIntelligenceInspection } from '../mission-control/cross-portfolio-intelligence-inspection.ts';

function parseArgs(argv: string[]): { crossPortfolioMissionIntelligenceSetId: string } {
  let crossPortfolioMissionIntelligenceSetId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--intelligence-set') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --intelligence-set');
      }
      crossPortfolioMissionIntelligenceSetId = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--intelligence-set=')) {
      const value = arg.slice('--intelligence-set='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --intelligence-set');
      }
      crossPortfolioMissionIntelligenceSetId = value;
      continue;
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!crossPortfolioMissionIntelligenceSetId) {
    throw new Error('MISSING_ARGUMENT: --intelligence-set');
  }

  return { crossPortfolioMissionIntelligenceSetId };
}

function toStableError(error: unknown): string {
  return (error as Error).message === 'CROSS_PORTFOLIO_INTELLIGENCE_SET_NOT_FOUND'
    ? 'intelligence_set_not_found'
    : (error as Error).message;
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createCrossPortfolioMissionIntelligenceInspection().inspectSharedDependencies(args));
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
    process.stdout.write(`${canonicalStringify({ error: 'CROSS_PORTFOLIO_DEPENDENCIES_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
