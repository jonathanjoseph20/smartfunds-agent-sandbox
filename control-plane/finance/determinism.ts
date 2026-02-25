import { createHash } from 'node:crypto';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function normalizeArray(values: unknown[]): JsonValue[] {
  return values.map((value) => {
    const normalized = normalizeValue(value);
    return normalized === undefined ? null : normalized;
  });
}

function normalizeObject(value: Record<string, unknown>): { [key: string]: JsonValue } {
  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  const result: { [key: string]: JsonValue } = {};
  for (const [key, entryValue] of entries) {
    const normalized = normalizeValue(entryValue);
    if (normalized !== undefined) {
      result[key] = normalized;
    }
  }

  return result;
}

function normalizeValue(value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return normalizeArray(value);
  }
  if (typeof value === 'object') {
    return normalizeObject(value as Record<string, unknown>);
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

export function canonicalStringify(value: unknown): string {
  const normalized = normalizeValue(value);
  return JSON.stringify(normalized ?? null);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
