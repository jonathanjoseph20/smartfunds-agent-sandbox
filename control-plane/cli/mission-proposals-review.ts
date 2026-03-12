import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionProposalInspection } from '../missions/proposals/mission-proposal-inspection.ts';

interface ParsedArgs {
  proposalId: string;
  decision: 'approved' | 'rejected';
  reviewedBy: string;
  reasonFile: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let proposalId: string | null = null;
  let decision: ParsedArgs['decision'] | null = null;
  let reviewedBy: string | null = null;
  let reasonFile: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    const consume = (flag: string): string => {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`MISSING_ARGUMENT: ${flag}`);
      }
      index += 1;
      return value;
    };

    if (arg === '--proposal') {
      proposalId = consume('--proposal');
      continue;
    }
    if (arg.startsWith('--proposal=')) {
      proposalId = arg.slice('--proposal='.length);
      continue;
    }

    if (arg === '--decision') {
      decision = consume('--decision') as ParsedArgs['decision'];
      continue;
    }
    if (arg.startsWith('--decision=')) {
      decision = arg.slice('--decision='.length) as ParsedArgs['decision'];
      continue;
    }

    if (arg === '--reviewed-by') {
      reviewedBy = consume('--reviewed-by');
      continue;
    }
    if (arg.startsWith('--reviewed-by=')) {
      reviewedBy = arg.slice('--reviewed-by='.length);
      continue;
    }

    if (arg === '--reason-file') {
      reasonFile = consume('--reason-file');
      continue;
    }
    if (arg.startsWith('--reason-file=')) {
      reasonFile = arg.slice('--reason-file='.length);
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!proposalId) {
    throw new Error('MISSING_ARGUMENT: --proposal');
  }
  if (!decision) {
    throw new Error('MISSING_ARGUMENT: --decision');
  }
  if (!(decision === 'approved' || decision === 'rejected')) {
    throw new Error('INVALID_ARGUMENT: --decision must be approved|rejected');
  }
  if (!reviewedBy) {
    throw new Error('MISSING_ARGUMENT: --reviewed-by');
  }
  if (!reasonFile) {
    throw new Error('MISSING_ARGUMENT: --reason-file');
  }

  return {
    proposalId,
    decision,
    reviewedBy,
    reasonFile,
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createMissionProposalInspection();
    const reason = fs.readFileSync(args.reasonFile, 'utf8').trim();

    printJson(inspection.reviewProposal({
      proposalId: args.proposalId,
      decision: args.decision,
      reviewedBy: args.reviewedBy,
      reason,
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
