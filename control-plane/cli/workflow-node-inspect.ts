import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionJournal } from '../journal/journal.ts';
import { getNodeDiagnosticReport } from '../observability/diagnostics.ts';
import { buildWorkflowNodeRecords } from '../observability/node-record.ts';
import { buildWorkflowRunRecord } from '../observability/run-record.ts';

type ParsedArgs = {
  runId: string;
  nodeId: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  let runId: string | null = null;
  let nodeId: string | null = null;

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

    if (arg === '--node') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --node');
      }
      nodeId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--node=')) {
      nodeId = arg.slice('--node='.length);
      if (!nodeId) {
        throw new Error('MISSING_ARGUMENT: --node');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!runId) {
    throw new Error('MISSING_ARGUMENT: --run');
  }
  if (!nodeId) {
    throw new Error('MISSING_ARGUMENT: --node');
  }

  return {
    runId,
    nodeId
  };
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

    const diagnostic = getNodeDiagnosticReport({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      nodeId: args.nodeId,
      nodes: nodeRecords
    });

    printJson(diagnostic);
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
