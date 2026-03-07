import { canonicalStringify } from '../finance/determinism.ts';
import { loadWorkflowDefinitionById } from '../workflows/workflow-loader.ts';

function parseArgs(argv: string[]): { workflowId: string } {
  let workflowId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--workflow') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --workflow');
      }
      workflowId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--workflow=')) {
      workflowId = arg.slice('--workflow='.length);
      if (!workflowId) {
        throw new Error('MISSING_ARGUMENT: --workflow');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!workflowId) {
    throw new Error('MISSING_ARGUMENT: --workflow');
  }

  return { workflowId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const workflow = loadWorkflowDefinitionById(args.workflowId);
    printJson({ valid: true, workflowId: workflow.workflowId });
    return 0;
  } catch (error) {
    printJson({ valid: false, error: (error as Error).message });
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write(`${canonicalStringify({ valid: false, error: 'unexpected_runtime_error' })}\n`);
    process.exit(2);
  });
}
