import { canonicalStringify } from '../finance/determinism.ts';
import { createTaskExecutionInspection } from '../task-execution/task-execution-inspection.ts';

function parseJson(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_RESULT_PAYLOAD');
  }
  return parsed as Record<string, unknown>;
}

function parseArgs(argv: string[]): {
  taskGraphId: string;
  taskNodeId: string;
  workerId: string;
  claimId: string;
  attemptIndex: number;
  resultPayload: Record<string, unknown>;
} {
  let taskGraphId: string | null = null;
  let taskNodeId: string | null = null;
  let workerId: string | null = null;
  let claimId: string | null = null;
  let attemptIndex: number | null = null;
  let resultPayload: Record<string, unknown> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    const needsValue = (name: string): string => {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(name);
      }
      index += 1;
      return value;
    };

    if (arg === '--graph') {
      taskGraphId = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH');
      continue;
    }
    if (arg.startsWith('--graph=')) {
      taskGraphId = arg.slice('--graph='.length) || null;
      if (!taskGraphId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH');
      continue;
    }
    if (arg === '--node') {
      taskNodeId = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_NODE');
      continue;
    }
    if (arg.startsWith('--node=')) {
      taskNodeId = arg.slice('--node='.length) || null;
      if (!taskNodeId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_NODE');
      continue;
    }
    if (arg === '--worker') {
      workerId = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_WORKER');
      continue;
    }
    if (arg.startsWith('--worker=')) {
      workerId = arg.slice('--worker='.length) || null;
      if (!workerId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_WORKER');
      continue;
    }
    if (arg === '--claim') {
      claimId = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_CLAIM');
      continue;
    }
    if (arg.startsWith('--claim=')) {
      claimId = arg.slice('--claim='.length) || null;
      if (!claimId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_CLAIM');
      continue;
    }
    if (arg === '--attempt') {
      const value = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_ATTEMPT');
      if (!Number.isInteger(Number(value))) throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_ATTEMPT');
      attemptIndex = Number(value);
      continue;
    }
    if (arg.startsWith('--attempt=')) {
      const value = arg.slice('--attempt='.length);
      if (!value || !Number.isInteger(Number(value))) throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_ATTEMPT');
      attemptIndex = Number(value);
      continue;
    }
    if (arg === '--payload') {
      resultPayload = parseJson(needsValue('TASK_EXECUTION_ARGUMENT_MISSING_RESULT_PAYLOAD'));
      continue;
    }
    if (arg.startsWith('--payload=')) {
      const value = arg.slice('--payload='.length);
      if (!value) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_RESULT_PAYLOAD');
      resultPayload = parseJson(value);
      continue;
    }

    throw new Error('TASK_EXECUTION_UNKNOWN_ARGUMENT');
  }

  if (!taskGraphId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH');
  if (!taskNodeId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_NODE');
  if (!workerId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_WORKER');
  if (!claimId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_CLAIM');
  if (attemptIndex === null) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_ATTEMPT');

  return { taskGraphId, taskNodeId, workerId, claimId, attemptIndex, resultPayload };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createTaskExecutionInspection().taskExecutionComplete(args));
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
    process.stdout.write(`${canonicalStringify({ error: 'TASK_EXECUTION_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
