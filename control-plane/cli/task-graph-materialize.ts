import { canonicalStringify } from '../finance/determinism.ts';
import { createTaskGraphInspection } from '../task-graph/task-graph-inspection.ts';

function parseArgs(argv: string[]): { taskGraphId: string } {
  let taskGraphId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--graph') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --graph');
      }
      taskGraphId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--graph=')) {
      const value = arg.slice('--graph='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --graph');
      }
      taskGraphId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!taskGraphId) {
    throw new Error('MISSING_ARGUMENT: --graph');
  }

  return { taskGraphId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createTaskGraphInspection();
    printJson(inspection.materializeTaskGraph(args));
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
