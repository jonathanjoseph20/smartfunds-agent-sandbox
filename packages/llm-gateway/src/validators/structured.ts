import type { JsonSchemaLike } from "../types.js";

export type SchemaValidationResult =
  | { ok: true }
  | { ok: false; reason: string; path: string };

function typeOfValue(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function validateObject(value: unknown, schema: JsonSchemaLike, path: string): SchemaValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "Expected object", path };
  }

  const record = value as Record<string, unknown>;
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];

  for (const key of required) {
    if (!(key in record)) {
      return { ok: false, reason: `Missing required property ${key}`, path };
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) {
      if (!(key in properties)) {
        return { ok: false, reason: `Unexpected property ${key}`, path };
      }
    }
  }

  for (const [key, childSchema] of Object.entries(properties)) {
    if (!(key in record)) {
      continue;
    }

    const result = validateAgainstSchema(record[key], childSchema, `${path}.${key}`);
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}

function validateArray(value: unknown, schema: JsonSchemaLike, path: string): SchemaValidationResult {
  if (!Array.isArray(value)) {
    return { ok: false, reason: "Expected array", path };
  }

  if (!schema.items) {
    return { ok: true };
  }

  for (let i = 0; i < value.length; i += 1) {
    const result = validateAgainstSchema(value[i], schema.items, `${path}[${i}]`);
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}

export function validateAgainstSchema(value: unknown, schema: JsonSchemaLike, path: string): SchemaValidationResult {
  if (schema.enum) {
    const matches = schema.enum.some((entry) => JSON.stringify(entry) === JSON.stringify(value));
    if (!matches) {
      return { ok: false, reason: "Value not in enum", path };
    }
  }

  if (!schema.type) {
    return { ok: true };
  }

  if (schema.type === "object") {
    return validateObject(value, schema, path);
  }

  if (schema.type === "array") {
    return validateArray(value, schema, path);
  }

  if (schema.type === "string" || schema.type === "number" || schema.type === "boolean") {
    const actual = typeOfValue(value);
    if (actual !== schema.type) {
      return { ok: false, reason: `Expected ${schema.type} but got ${actual}`, path };
    }
    return { ok: true };
  }

  return { ok: true };
}
