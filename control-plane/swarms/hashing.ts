import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { SwarmExecutionPlan, SwarmExecutionReceipt } from './types.ts';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertLinkedIntents(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
    throw new Error('linkedIntents must be an array of non-empty strings.');
  }
}

export function hashSwarmExecutionPlan(plan: SwarmExecutionPlan): string {
  return sha256(canonicalStringify(plan));
}

export function hashSwarmExecutionReceipt(receipt: SwarmExecutionReceipt): string {
  if (receipt.linkedIntents !== undefined) {
    assertLinkedIntents(receipt.linkedIntents);
  }
  return sha256(canonicalStringify(receipt));
}
