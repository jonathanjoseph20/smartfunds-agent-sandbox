import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionJournal } from '../journal/journal.ts';
import type { ExecutionEvent } from '../journal/types.ts';
import { createSwarmRunner } from '../swarm/swarm-runner.ts';

type ParsedArgs = {
  runId: string;
};

function parseArgs(argv: string[]): ParsedArgs {
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

  return {
    runId
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractLatestContextSnapshot(events: ExecutionEvent[]): Record<string, unknown> {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const payload = ordered[index].payload;
    if (!isRecord(payload)) {
      continue;
    }

    const snapshot = payload.context_snapshot;
    if (isRecord(snapshot)) {
      return snapshot;
    }
  }

  return {
    memory: {},
    artifacts: [],
    metadata: {}
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const journal = createExecutionJournal();
    const runner = createSwarmRunner({ journal });

    const inspected = journal.inspectRun(args.runId);
    const summary = runner.getSwarmRunStatus({ runId: args.runId });
    const contextSnapshot = extractLatestContextSnapshot(inspected.events);

    printJson({
      runId: summary.runId,
      currentPhase: summary.currentPhase,
      tasks: summary.taskSummaries,
      context: {
        memory: isRecord(contextSnapshot.memory) ? contextSnapshot.memory : {},
        artifacts: Array.isArray(contextSnapshot.artifacts)
          ? contextSnapshot.artifacts.filter((entry): entry is string => typeof entry === 'string').sort((left, right) => left.localeCompare(right))
          : [],
        metadata: isRecord(contextSnapshot.metadata) ? contextSnapshot.metadata : {}
      }
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
