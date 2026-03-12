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
  resultType: 'FAILURE' | 'RETRY_REQUESTED';
  resultPayload: Record<string, unknown>;
  failureClass: 'RETRYABLE_FAILURE' | 'NON_RETRYABLE_FAILURE' | 'SYSTEM_FAILURE' | 'POLICY_FAILURE' | 'DEPENDENCY_FAILURE';
  retryEligible: boolean;
} {
  let taskGraphId: string | null = null;
  let taskNodeId: string | null = null;
  let workerId: string | null = null;
  let claimId: string | null = null;
  let attemptIndex: number | null = null;
  let resultType: 'FAILURE' | 'RETRY_REQUESTED' = 'FAILURE';
  let resultPayload: Record<string, unknown> = {};
  let failureClass: 'RETRYABLE_FAILURE' | 'NON_RETRYABLE_FAILURE' | 'SYSTEM_FAILURE' | 'POLICY_FAILURE' | 'DEPENDENCY_FAILURE' = 'NON_RETRYABLE_FAILURE';
  let retryEligible = false;

  const bool = (value: string): boolean => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_RETRY_ELIGIBLE');
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const needsValue = (name: string): string => {
      const value = argv[index + 1];
      if (!value) throw new Error(name);
      index += 1;
      return value;
    };

    if (arg === '--graph') { taskGraphId = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH'); continue; }
    if (arg.startsWith('--graph=')) { taskGraphId = arg.slice('--graph='.length) || null; if (!taskGraphId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH'); continue; }
    if (arg === '--node') { taskNodeId = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_NODE'); continue; }
    if (arg.startsWith('--node=')) { taskNodeId = arg.slice('--node='.length) || null; if (!taskNodeId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_NODE'); continue; }
    if (arg === '--worker') { workerId = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_WORKER'); continue; }
    if (arg.startsWith('--worker=')) { workerId = arg.slice('--worker='.length) || null; if (!workerId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_WORKER'); continue; }
    if (arg === '--claim') { claimId = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_CLAIM'); continue; }
    if (arg.startsWith('--claim=')) { claimId = arg.slice('--claim='.length) || null; if (!claimId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_CLAIM'); continue; }
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
    if (arg === '--result-type') {
      const value = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_RESULT_TYPE');
      if (value !== 'FAILURE' && value !== 'RETRY_REQUESTED') throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_RESULT_TYPE');
      resultType = value;
      continue;
    }
    if (arg.startsWith('--result-type=')) {
      const value = arg.slice('--result-type='.length);
      if (value !== 'FAILURE' && value !== 'RETRY_REQUESTED') throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_RESULT_TYPE');
      resultType = value;
      continue;
    }
    if (arg === '--payload') { resultPayload = parseJson(needsValue('TASK_EXECUTION_ARGUMENT_MISSING_RESULT_PAYLOAD')); continue; }
    if (arg.startsWith('--payload=')) {
      const value = arg.slice('--payload='.length);
      if (!value) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_RESULT_PAYLOAD');
      resultPayload = parseJson(value);
      continue;
    }
    if (arg === '--failure-class') {
      const value = needsValue('TASK_EXECUTION_ARGUMENT_MISSING_FAILURE_CLASS');
      if (!['RETRYABLE_FAILURE', 'NON_RETRYABLE_FAILURE', 'SYSTEM_FAILURE', 'POLICY_FAILURE', 'DEPENDENCY_FAILURE'].includes(value)) {
        throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_FAILURE_CLASS');
      }
      failureClass = value as typeof failureClass;
      continue;
    }
    if (arg.startsWith('--failure-class=')) {
      const value = arg.slice('--failure-class='.length);
      if (!['RETRYABLE_FAILURE', 'NON_RETRYABLE_FAILURE', 'SYSTEM_FAILURE', 'POLICY_FAILURE', 'DEPENDENCY_FAILURE'].includes(value)) {
        throw new Error('TASK_EXECUTION_ARGUMENT_INVALID_FAILURE_CLASS');
      }
      failureClass = value as typeof failureClass;
      continue;
    }
    if (arg === '--retry-eligible') { retryEligible = bool(needsValue('TASK_EXECUTION_ARGUMENT_MISSING_RETRY_ELIGIBLE')); continue; }
    if (arg.startsWith('--retry-eligible=')) { retryEligible = bool(arg.slice('--retry-eligible='.length)); continue; }

    throw new Error('TASK_EXECUTION_UNKNOWN_ARGUMENT');
  }

  if (!taskGraphId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_GRAPH');
  if (!taskNodeId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_NODE');
  if (!workerId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_WORKER');
  if (!claimId) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_CLAIM');
  if (attemptIndex === null) throw new Error('TASK_EXECUTION_ARGUMENT_MISSING_ATTEMPT');

  return {
    taskGraphId,
    taskNodeId,
    workerId,
    claimId,
    attemptIndex,
    resultType,
    resultPayload,
    failureClass,
    retryEligible,
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createTaskExecutionInspection().taskExecutionFail(args));
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
