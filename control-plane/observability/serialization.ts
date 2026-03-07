import { canonicalStringify } from '../finance/determinism.ts';

export type JsonScalar = null | boolean | number | string;
export type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stableSortStrings(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function stableUniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function normalizeJson(value: unknown): JsonValue {
  return JSON.parse(canonicalStringify(value)) as JsonValue;
}

export function toPlainObject(value: unknown): Record<string, JsonValue> {
  if (!isPlainRecord(value)) {
    return {};
  }
  return normalizeJson(value) as Record<string, JsonValue>;
}

export function sanitizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries) as T;
}

export function canonicalJson(value: unknown): string {
  return canonicalStringify(value);
}
