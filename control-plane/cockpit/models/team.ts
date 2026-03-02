import { optionalBoolean, optionalIdempotencyKey, optionalString, requireObject, requireString } from './_common.ts';

export interface Team {
  teamId: string;
  projectId: string;
  name: string;
  archivedAt: string | null;
}

export interface CreateTeamInput {
  projectId: string;
  name: string;
  idempotencyKey: string | null;
}

export interface PatchTeamInput {
  name: string | null;
  archived: boolean | null;
}

export function parseCreateTeamInput(value: unknown): CreateTeamInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    projectId: requireString(body.projectId, 'projectId'),
    name: requireString(body.name, 'name'),
    idempotencyKey: optionalIdempotencyKey(body.idempotencyKey)
  };
}

export function parsePatchTeamInput(value: unknown): PatchTeamInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    name: optionalString(body.name, 'name'),
    archived: optionalBoolean(body.archived, 'archived')
  };
}
