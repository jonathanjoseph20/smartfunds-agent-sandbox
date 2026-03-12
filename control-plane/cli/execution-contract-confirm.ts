import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionContractInspection } from '../execution-contract/execution-contract-inspection.ts';

function parseArgs(argv: string[]): { missionId: string; reviewedBy?: string; executionPolicyId?: string } {
  let missionId: string | null = null;
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

  return {
    missionId,
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
    const inspection = createExecutionContractInspection();
    printJson(inspection.confirmExecutionContract(args));
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
