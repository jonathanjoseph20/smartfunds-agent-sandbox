import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionContractInspection } from '../execution-contract/execution-contract-inspection.ts';

function parseArgs(argv: string[]): { executionPolicyId?: string } {
  if (argv.length === 0) {
    return {};
  }

  if (argv.length === 2 && argv[0] === '--policy') {
    if (!argv[1]) {
      throw new Error('MISSING_ARGUMENT: --policy');
    }
    return { executionPolicyId: argv[1] };
  }

  if (argv.length === 1 && argv[0].startsWith('--policy=')) {
    const executionPolicyId = argv[0].slice('--policy='.length);
    if (!executionPolicyId) {
      throw new Error('MISSING_ARGUMENT: --policy');
    }
    return { executionPolicyId };
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createExecutionContractInspection();
    printJson(inspection.listExecutionContracts(args));
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
