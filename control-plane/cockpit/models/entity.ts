import { optionalIdempotencyKey, requireObject, requireString } from './_common.ts';

export interface Entity {
  entityId: string;
  name: string;
}

export interface CreateEntityInput {
  name: string;
  idempotencyKey: string | null;
}

export function parseCreateEntityInput(value: unknown): CreateEntityInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    name: requireString(body.name, 'name'),
    idempotencyKey: optionalIdempotencyKey(body.idempotencyKey)
  };
}
