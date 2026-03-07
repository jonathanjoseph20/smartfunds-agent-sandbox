import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionJournal } from '../journal/journal.ts';
import { extractWorkflowFailures, firstInspectTarget } from '../observability/diagnostics.ts';
import { buildWorkflowNodeRecords } from '../observability/node-record.ts';
import { buildWorkflowRunRecord } from '../observability/run-record.ts';

function parseArgs(argv: string[]): { runId: string } {
  let runId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--run') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --run');
      }
      runId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--run=')) {
      runId = arg.slice('--run='.length);
      if (!runId) {
        throw new Error('MISSING_ARGUMENT: --run');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!runId) {
    throw new Error('MISSING_ARGUMENT: --run');
  }

  return { runId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const journal = createExecutionJournal();
    const inspected = journal.inspectRun(args.runId);
    const runRecord = buildWorkflowRunRecord(inspected);
    const nodeRecords = buildWorkflowNodeRecords({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      events: inspected.events
    });

    const failures = extractWorkflowFailures(nodeRecords);
    printJson({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      failureCount: failures.length,
      failures,
      firstInspectTarget: firstInspectTarget({
        runId: runRecord.runId,
        status: runRecord.status,
        activeNodeId: runRecord.activeNodeId,
        nodes: nodeRecords
      })
    });
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
