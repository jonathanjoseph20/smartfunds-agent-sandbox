import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionJournal } from '../journal/journal.ts';
import { buildWorkflowRunRecords } from '../observability/run-record.ts';

type ParsedArgs = {
  limit: number | null;
};

function parseArgs(argv: string[]): ParsedArgs {
  let limit: number | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--json') {
      continue;
    }

    if (arg === '--limit') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --limit');
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('INVALID_ARGUMENT: --limit');
      }
      limit = parsed;
      index += 1;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = arg.slice('--limit='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('INVALID_ARGUMENT: --limit');
      }
      limit = parsed;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  return { limit };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const journal = createExecutionJournal();
    const runRecords = buildWorkflowRunRecords({
      runs: journal.listRuns(),
      inspectRun: (runId) => journal.inspectRun(runId)
    });

    const projected = runRecords.map((run) => ({
      runId: run.runId,
      workflowId: run.workflowId,
      missionId: run.missionId,
      status: run.status,
      completedNodeCount: run.completedNodeCount,
      failedNodeCount: run.failedNodeCount
    }));

    const list = args.limit === null ? projected : projected.slice(0, args.limit);
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
