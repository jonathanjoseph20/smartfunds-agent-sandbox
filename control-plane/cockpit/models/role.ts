import { optionalBoolean, optionalIdempotencyKey, optionalString, requireObject, requireString } from './_common.ts';

export interface Role {
  roleId: string;
  teamId: string;
  name: string;
  assigneeRef: string | null;
  archivedAt: string | null;
}

export interface CreateRoleInput {
  teamId: string;
  name: string;
  assigneeRef: string | null;
  idempotencyKey: string | null;
}

export interface PatchRoleInput {
  name: string | null;
  assigneeRef: string | null | undefined;
  archived: boolean | null;
}

export function parseCreateRoleInput(value: unknown): CreateRoleInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    teamId: requireString(body.teamId, 'teamId'),
    name: requireString(body.name, 'name'),
    assigneeRef: optionalString(body.assigneeRef, 'assigneeRef'),
    idempotencyKey: optionalIdempotencyKey(body.idempotencyKey)
  };
}

export function parsePatchRoleInput(value: unknown): PatchRoleInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    name: optionalString(body.name, 'name'),
    assigneeRef: body.assigneeRef === undefined ? undefined : optionalString(body.assigneeRef, 'assigneeRef'),
    archived: optionalBoolean(body.archived, 'archived')
  };
}
