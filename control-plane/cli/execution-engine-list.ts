import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionEngineInspection } from '../execution-engine/execution-engine-inspection.ts';

function parseArgs(argv: string[]): { enginePolicyId?: string } {
  if (argv.length === 0) {
    return {};
  }

  if (argv.length === 2 && argv[0] === '--policy') {
    const enginePolicyId = argv[1];
    if (!enginePolicyId) {
      throw new Error('MISSING_ARGUMENT: --policy');
    }
    return { enginePolicyId };
  }

  if (argv.length === 1 && argv[0].startsWith('--policy=')) {
    const enginePolicyId = argv[0].slice('--policy='.length);
    if (!enginePolicyId) {
      throw new Error('MISSING_ARGUMENT: --policy');
    }
    return { enginePolicyId };
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createExecutionEngineInspection();
    printJson(inspection.listEngineRuns(args));
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
