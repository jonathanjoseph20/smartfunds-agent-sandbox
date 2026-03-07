import { canonicalStringify } from '../finance/determinism.ts';
import { WorkflowDag } from '../workflows/workflow-dag.ts';
import { loadWorkflowDefinitionById } from '../workflows/workflow-loader.ts';
import type { WorkflowInspectResult } from '../workflows/workflow-types.ts';

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

function buildInspectResult(workflowId: string): WorkflowInspectResult {
  const workflow = loadWorkflowDefinitionById(workflowId);
  const dag = new WorkflowDag(workflow);

  return {
    workflowId: workflow.workflowId,
    nodes: workflow.nodes
      .map((node) => ({
        id: node.id,
        task: node.task,
        ...(node.agent ? { agent: node.agent } : {}),
        ...(node.phase ? { phase: node.phase } : {}),
        dependsOn: [...(node.dependsOn ?? [])]
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    executionOrder: dag.getExecutionOrder()
  };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(buildInspectResult(args.workflowId));
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
