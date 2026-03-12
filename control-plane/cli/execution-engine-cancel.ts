import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionEngineInspection } from '../execution-engine/execution-engine-inspection.ts';

function parseArgs(argv: string[]): { executionAttemptId: string; reasonFile: string; enginePolicyId?: string } {
  let executionAttemptId: string | null = null;
  let reasonFile: string | null = null;
  let enginePolicyId: string | undefined;

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

    if (arg === '--attempt') {
      executionAttemptId = consume('--attempt');
      continue;
    }
    if (arg.startsWith('--attempt=')) {
      executionAttemptId = arg.slice('--attempt='.length);
      if (!executionAttemptId) {
        throw new Error('MISSING_ARGUMENT: --attempt');
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

    if (arg === '--policy') {
      enginePolicyId = consume('--policy');
      continue;
    }
    if (arg.startsWith('--policy=')) {
      enginePolicyId = arg.slice('--policy='.length);
      if (!enginePolicyId) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!executionAttemptId) {
    throw new Error('MISSING_ARGUMENT: --attempt');
  }
  if (!reasonFile) {
    throw new Error('MISSING_ARGUMENT: --reason-file');
  }

  return {
    executionAttemptId,
    reasonFile,
    ...(enginePolicyId ? { enginePolicyId } : {}),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const cancellationReason = fs.readFileSync(args.reasonFile, 'utf8').trim();
    if (!cancellationReason) {
      throw new Error('INVALID_ARGUMENT: --reason-file contains empty reason');
    }

    const inspection = createExecutionEngineInspection();
    printJson(inspection.cancelEngineRun({
      executionAttemptId: args.executionAttemptId,
      cancellationReason,
      ...(args.enginePolicyId ? { enginePolicyId: args.enginePolicyId } : {}),
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
