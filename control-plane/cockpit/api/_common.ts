import type { DatabaseSync } from 'node:sqlite';

import { ValidationError } from '../models/_common.ts';
import { CockpitError } from '../service/invariants.ts';

export interface CockpitApiRequest {
  method: string;
  pathname: string;
  query?: URLSearchParams;
  bodyText: string | null;
}

export interface CockpitApiResponse {
  statusCode: number;
  payload: unknown;
}

export interface CockpitApiContext {
  db: DatabaseSync;
  now: () => string;
}

export type CockpitRouteHandler = (request: CockpitApiRequest, ctx: CockpitApiContext) => CockpitApiResponse | null;

export function response(statusCode: number, payload: unknown): CockpitApiResponse {
  return { statusCode, payload };
}

export function parseBody(bodyText: string | null): unknown {
  if (!bodyText || bodyText.trim().length === 0) {
    return {};
  }
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new CockpitError(400, 'invalid json');
  }
}

export function parseIncludeArchived(query: URLSearchParams | undefined): boolean {
  const includeArchived = query?.get('includeArchived');
  return includeArchived === 'true';
}

export function parseIntegerParam(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CockpitError(400, `${field} must be a non-negative integer`);
  }
  return parsed;
}

export function jsonOrNull(value: string | null): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }
  return JSON.parse(value) as Record<string, unknown>;
}

export function withErrorHandling(fn: () => CockpitApiResponse | null): CockpitApiResponse | null {
  try {
    return fn();
  } catch (error) {
    if (error instanceof CockpitError) {
      return response(error.statusCode, { error: error.message });
    }
    if (error instanceof ValidationError) {
      return response(400, { error: error.message });
    }
    if (error instanceof Error && error.message === 'status must be active or disabled') {
      return response(400, { error: error.message });
    }
    return response(400, { error: 'invalid request' });
  }
}
