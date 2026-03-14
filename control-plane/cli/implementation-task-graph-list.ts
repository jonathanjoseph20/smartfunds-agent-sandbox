import { canonicalStringify } from '../finance/determinism.ts';
import { createImplementationTaskGraphInspection } from '../tasks/task-graph-inspection.ts';

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    if (argv.length > 0) {
      throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
    }

    const inspection = createImplementationTaskGraphInspection();
    const list = inspection.listTaskGraphs().map((entry) => ({
      taskGraphId: entry.taskGraphId,
      planId: entry.planId,
      specId: entry.specId,
      status: entry.status,
      nodeCount: entry.nodeCount,
      edgeCount: entry.edgeCount,
    }));
    printJson(list);
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
