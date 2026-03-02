import { optionalIdempotencyKey } from './_common.ts';

export interface RunAttempt {
  runId: string;
  attemptIndex: number;
  status: string;
  idempotencyKey: string | null;
}

export interface RetryRunInput {
  idempotencyKey: string | null;
}

export function parseRetryRunInput(value: unknown): RetryRunInput {
  if (value === null || value === undefined) {
    return { idempotencyKey: null };
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return { idempotencyKey: null };
  }

  return {
    idempotencyKey: optionalIdempotencyKey((value as Record<string, unknown>).idempotencyKey)
  };
}
