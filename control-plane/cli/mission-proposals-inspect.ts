import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionProposalInspection } from '../missions/proposals/mission-proposal-inspection.ts';

function parseArgs(argv: string[]): { proposalId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--proposal') {
      const proposalId = argv[index + 1];
      if (!proposalId) {
        throw new Error('MISSING_ARGUMENT: --proposal');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { proposalId };
    }
    if (arg.startsWith('--proposal=')) {
      const proposalId = arg.slice('--proposal='.length);
      if (!proposalId) {
        throw new Error('MISSING_ARGUMENT: --proposal');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { proposalId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --proposal');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createMissionProposalInspection();
    printJson(inspection.inspectProposal(args.proposalId));
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
