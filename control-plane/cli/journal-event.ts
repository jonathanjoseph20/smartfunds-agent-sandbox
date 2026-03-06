import { canonicalStringify } from '../finance/determinism.ts';
import { createExecutionJournal } from '../journal/journal.ts';
import type { EventType, ExecutionPhase } from '../journal/types.ts';

type ParsedArgs = {
  runId: string;
  type: EventType;
  phase: ExecutionPhase;
  taskId?: string;
  payload?: Record<string, unknown>;
};

function parseType(value: string): EventType {
  if (
    value === 'RUN_CREATED' ||
    value === 'PHASE_STARTED' ||
    value === 'PHASE_COMPLETED' ||
    value === 'TASK_STARTED' ||
    value === 'TASK_COMPLETED' ||
    value === 'TASK_FAILED' ||
    value === 'ARTIFACT_RECORDED' ||
    value === 'RUN_COMPLETED' ||
    value === 'RUN_FAILED'
  ) {
    return value;
  }

  throw new Error('INVALID_ARGUMENT: type');
}

function parsePhase(value: string): ExecutionPhase {
  if (
    value === 'plan' ||
    value === 'setup' ||
    value === 'implement' ||
    value === 'verify' ||
    value === 'test' ||
    value === 'release'
  ) {
    return value;
  }

  throw new Error('INVALID_ARGUMENT: phase');
}

function parsePayload(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('INVALID_ARGUMENT: payload');
  }
  return parsed as Record<string, unknown>;
}

function parseArgs(argv: string[]): ParsedArgs {
  let runId: string | null = null;
  let type: EventType | null = null;
  let phase: ExecutionPhase | null = null;
  let taskId: string | undefined;
  let payload: Record<string, unknown> | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--run') {
      const value = argv[index + 1];
      if (!value) throw new Error('MISSING_ARGUMENT: --run');
      runId = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--run=')) {
      runId = arg.slice('--run='.length);
      if (!runId) throw new Error('MISSING_ARGUMENT: --run');
      continue;
    }

    if (arg === '--type') {
      const value = argv[index + 1];
      if (!value) throw new Error('MISSING_ARGUMENT: --type');
      type = parseType(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--type=')) {
      type = parseType(arg.slice('--type='.length));
      continue;
    }

    if (arg === '--phase') {
      const value = argv[index + 1];
      if (!value) throw new Error('MISSING_ARGUMENT: --phase');
      phase = parsePhase(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--phase=')) {
      phase = parsePhase(arg.slice('--phase='.length));
      continue;
    }

    if (arg === '--task') {
      const value = argv[index + 1];
      if (!value) throw new Error('MISSING_ARGUMENT: --task');
      taskId = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--task=')) {
      taskId = arg.slice('--task='.length);
      if (!taskId) throw new Error('MISSING_ARGUMENT: --task');
      continue;
    }

    if (arg === '--payload') {
      const value = argv[index + 1];
      if (!value) throw new Error('MISSING_ARGUMENT: --payload');
      payload = parsePayload(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--payload=')) {
      payload = parsePayload(arg.slice('--payload='.length));
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!runId) throw new Error('MISSING_ARGUMENT: --run');
  if (!type) throw new Error('MISSING_ARGUMENT: --type');
  if (!phase) throw new Error('MISSING_ARGUMENT: --phase');

  return {
    runId,
    type,
    phase,
    ...(taskId ? { taskId } : {}),
    ...(payload ? { payload } : {})
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const journal = createExecutionJournal();
    const event = journal.appendEvent({
      runId: args.runId,
      type: args.type,
      phase: args.phase,
      taskId: args.taskId,
      payload: args.payload
    });
    printJson(event);
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
