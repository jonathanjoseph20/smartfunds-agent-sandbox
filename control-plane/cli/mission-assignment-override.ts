import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionAssignmentInspection } from '../mission-assignment/mission-assignment-inspection.ts';

interface ParsedArgs {
  missionId: string;
  selectedTeamId: string;
  reasonFile: string;
  reviewedBy?: string;
  assignmentPolicyId?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let missionId: string | null = null;
  let selectedTeamId: string | null = null;
  let reasonFile: string | null = null;
  let reviewedBy: string | undefined;
  let assignmentPolicyId: string | undefined;

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

    if (arg === '--team') {
      selectedTeamId = consume('--team');
      continue;
    }
    if (arg.startsWith('--team=')) {
      selectedTeamId = arg.slice('--team='.length);
      if (!selectedTeamId) {
        throw new Error('MISSING_ARGUMENT: --team');
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
      assignmentPolicyId = consume('--policy');
      continue;
    }
    if (arg.startsWith('--policy=')) {
      assignmentPolicyId = arg.slice('--policy='.length);
      if (!assignmentPolicyId) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!missionId) {
    throw new Error('MISSING_ARGUMENT: --mission');
  }
  if (!selectedTeamId) {
    throw new Error('MISSING_ARGUMENT: --team');
  }
  if (!reasonFile) {
    throw new Error('MISSING_ARGUMENT: --reason-file');
  }

  return {
    missionId,
    selectedTeamId,
    reasonFile,
    ...(reviewedBy ? { reviewedBy } : {}),
    ...(assignmentPolicyId ? { assignmentPolicyId } : {}),
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

    const inspection = createMissionAssignmentInspection();
    printJson(inspection.overrideAssignment({
      missionId: args.missionId,
      selectedTeamId: args.selectedTeamId,
      reason,
      ...(args.reviewedBy ? { reviewedBy: args.reviewedBy } : {}),
      ...(args.assignmentPolicyId ? { assignmentPolicyId: args.assignmentPolicyId } : {}),
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
