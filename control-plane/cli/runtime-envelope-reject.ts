import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { createRuntimeEnvelopeInspection } from '../runtime-envelope/runtime-envelope-inspection.ts';

interface ParsedArgs {
  runtimeEnvelopeId: string;
  reasonFile: string;
  reviewedBy?: string;
  runtimeEnvelopePolicyId?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let runtimeEnvelopeId: string | null = null;
  let reasonFile: string | null = null;
  let reviewedBy: string | undefined;
  let runtimeEnvelopePolicyId: string | undefined;

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

    if (arg === '--envelope') {
      runtimeEnvelopeId = consume('--envelope');
      continue;
    }
    if (arg.startsWith('--envelope=')) {
      runtimeEnvelopeId = arg.slice('--envelope='.length);
      if (!runtimeEnvelopeId) {
        throw new Error('MISSING_ARGUMENT: --envelope');
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
      runtimeEnvelopePolicyId = consume('--policy');
      continue;
    }
    if (arg.startsWith('--policy=')) {
      runtimeEnvelopePolicyId = arg.slice('--policy='.length);
      if (!runtimeEnvelopePolicyId) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!runtimeEnvelopeId) {
    throw new Error('MISSING_ARGUMENT: --envelope');
  }
  if (!reasonFile) {
    throw new Error('MISSING_ARGUMENT: --reason-file');
  }

  return {
    runtimeEnvelopeId,
    reasonFile,
    ...(reviewedBy ? { reviewedBy } : {}),
    ...(runtimeEnvelopePolicyId ? { runtimeEnvelopePolicyId } : {}),
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

    const inspection = createRuntimeEnvelopeInspection();
    printJson(inspection.rejectRuntimeEnvelope({
      runtimeEnvelopeId: args.runtimeEnvelopeId,
      reason,
      ...(args.reviewedBy ? { reviewedBy: args.reviewedBy } : {}),
      ...(args.runtimeEnvelopePolicyId ? { runtimeEnvelopePolicyId: args.runtimeEnvelopePolicyId } : {}),
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
