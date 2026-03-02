import { optionalBoolean, optionalIdempotencyKey, optionalString, requireObject, requireString } from './_common.ts';

export interface Project {
  projectId: string;
  entityId: string;
  name: string;
  archivedAt: string | null;
  defaultBillingProfileId: string | null;
}

export interface CreateProjectInput {
  entityId: string;
  name: string;
  idempotencyKey: string | null;
}

export interface PatchProjectInput {
  name: string | null;
  archived: boolean | null;
  defaultBillingProfileId: string | null | undefined;
}

export function parseCreateProjectInput(value: unknown): CreateProjectInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    entityId: requireString(body.entityId, 'entityId'),
    name: requireString(body.name, 'name'),
    idempotencyKey: optionalIdempotencyKey(body.idempotencyKey)
  };
}

export function parsePatchProjectInput(value: unknown): PatchProjectInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    name: optionalString(body.name, 'name'),
    archived: optionalBoolean(body.archived, 'archived'),
    defaultBillingProfileId: body.defaultBillingProfileId === undefined ? undefined : optionalString(body.defaultBillingProfileId, 'defaultBillingProfileId')
  };
}
