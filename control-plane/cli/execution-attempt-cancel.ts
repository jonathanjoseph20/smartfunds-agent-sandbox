import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionAttemptInspection } from '../execution-attempt/execution-attempt-inspection.ts';

interface ParsedArgs {
  executionAttemptId: string;
  reasonFile?: string;
  cancelledBy?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let executionAttemptId: string | null = null;
  let reasonFile: string | undefined;
  let cancelledBy: string | undefined;

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

    if (arg === '--cancelled-by') {
      cancelledBy = consume('--cancelled-by');
      continue;
    }
    if (arg.startsWith('--cancelled-by=')) {
      cancelledBy = arg.slice('--cancelled-by='.length);
      if (!cancelledBy) {
        throw new Error('MISSING_ARGUMENT: --cancelled-by');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!executionAttemptId) {
    throw new Error('MISSING_ARGUMENT: --attempt');
  }

  return {
    executionAttemptId,
    ...(reasonFile ? { reasonFile } : {}),
    ...(cancelledBy ? { cancelledBy } : {}),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const reason = args.reasonFile
      ? fs.readFileSync(args.reasonFile, 'utf8').trim()
      : undefined;

    if (args.reasonFile && !reason) {
      throw new Error('INVALID_ARGUMENT: --reason-file contains empty reason');
    }

    const inspection = createExecutionAttemptInspection();
    printJson(inspection.cancelExecutionAttempt({
      executionAttemptId: args.executionAttemptId,
      ...(reason ? { reason } : {}),
      ...(args.cancelledBy ? { cancelledBy: args.cancelledBy } : {}),
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
