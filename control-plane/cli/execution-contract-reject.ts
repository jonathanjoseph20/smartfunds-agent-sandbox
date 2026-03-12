import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionContractInspection } from '../execution-contract/execution-contract-inspection.ts';

interface ParsedArgs {
  missionId: string;
  reasonFile: string;
  reviewedBy?: string;
  executionPolicyId?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let missionId: string | null = null;
  let reasonFile: string | null = null;
  let reviewedBy: string | undefined;
  let executionPolicyId: string | undefined;

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

    if (arg === '--mission') {
      missionId = consume('--mission');
      continue;
    }
    if (arg.startsWith('--mission=')) {
      missionId = arg.slice('--mission='.length);
      if (!missionId) {
        throw new Error('MISSING_ARGUMENT: --mission');
      }
      continue;
    }

    if (arg === '--reason-file') {
      reasonFile = consume('--reason-file');
      continue;
    }
    if (arg.startsWith('--reason-file=')) {
      reasonFile = arg.slice('--reason-file='.length);
      if (!reasonFile) {
        throw new Error('MISSING_ARGUMENT: --reason-file');
      }
      continue;
    }

    if (arg === '--reviewed-by') {
      reviewedBy = consume('--reviewed-by');
      continue;
    }
    if (arg.startsWith('--reviewed-by=')) {
      reviewedBy = arg.slice('--reviewed-by='.length);
      if (!reviewedBy) {
        throw new Error('MISSING_ARGUMENT: --reviewed-by');
      }
      continue;
    }

    if (arg === '--policy') {
      executionPolicyId = consume('--policy');
      continue;
    }
    if (arg.startsWith('--policy=')) {
      executionPolicyId = arg.slice('--policy='.length);
      if (!executionPolicyId) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!missionId) {
    throw new Error('MISSING_ARGUMENT: --mission');
  }
  if (!reasonFile) {
    throw new Error('MISSING_ARGUMENT: --reason-file');
  }

  return {
    missionId,
    reasonFile,
    ...(reviewedBy ? { reviewedBy } : {}),
    ...(executionPolicyId ? { executionPolicyId } : {}),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const reason = fs.readFileSync(args.reasonFile, 'utf8').trim();
    if (!reason) {
      throw new Error('INVALID_ARGUMENT: --reason-file contains empty reason');
    }

    const inspection = createExecutionContractInspection();
    printJson(inspection.rejectExecutionContract({
      missionId: args.missionId,
      reason,
      ...(args.reviewedBy ? { reviewedBy: args.reviewedBy } : {}),
      ...(args.executionPolicyId ? { executionPolicyId: args.executionPolicyId } : {}),
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
