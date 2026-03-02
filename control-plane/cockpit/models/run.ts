import { optionalIdempotencyKey } from './_common.ts';

export interface Run {
  runId: string;
  projectId: string;
  goalId: string;
  runIndex: number;
  status: string;
  idempotencyKey: string | null;
}

export interface StartRunInput {
  idempotencyKey: string | null;
}

export function parseStartRunInput(value: unknown): StartRunInput {
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
