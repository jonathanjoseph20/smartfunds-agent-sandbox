import { canonicalStringify } from '../finance/determinism.ts';

import type { RailClass } from './charge-intent-types.ts';

export function normalizeString(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

export function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function uniqueSortedRails(values: RailClass[]): RailClass[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(value)) as Record<string, unknown>;
}

export function asAmountString(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{2})$/.test(trimmed)) {
    throw new Error(`INVALID_AMOUNT: ${value}`);
  }

  return trimmed;
}
