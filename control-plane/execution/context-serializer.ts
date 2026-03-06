import { canonicalStringify } from '../finance/determinism.ts';
import { cloneExecutionContext } from './execution-context.ts';
import type { ExecutionContext } from './context-types.ts';

export function canonicalizeExecutionContext(context: ExecutionContext): ExecutionContext {
  return cloneExecutionContext(context);
}

export function serializeExecutionContext(context: ExecutionContext): string {
  return canonicalStringify(canonicalizeExecutionContext(context));
}
