import { optionalBoolean, optionalIdempotencyKey, optionalObject, optionalString, requireObject, requireString } from './_common.ts';

export interface Goal {
  goalId: string;
  projectId: string;
  teamId: string;
  title: string;
  goalType: string;
  specRef: string | null;
  specJson: string | null;
  archivedAt: string | null;
}

export interface CreateGoalInput {
  projectId: string;
  teamId: string;
  title: string;
  goalType: string;
  specRef: string | null;
  specJson: Record<string, unknown> | null;
  idempotencyKey: string | null;
}

export interface PatchGoalInput {
  title: string | null;
  goalType: string | null;
  specRef: string | null | undefined;
  specJson: Record<string, unknown> | null | undefined;
  archived: boolean | null;
}

export function parseCreateGoalInput(value: unknown): CreateGoalInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    projectId: requireString(body.projectId, 'projectId'),
    teamId: requireString(body.teamId, 'teamId'),
    title: requireString(body.title, 'title'),
    goalType: requireString(body.goalType, 'goalType'),
    specRef: optionalString(body.specRef, 'specRef'),
    specJson: optionalObject(body.specJson, 'specJson'),
    idempotencyKey: optionalIdempotencyKey(body.idempotencyKey)
  };
}

export function parsePatchGoalInput(value: unknown): PatchGoalInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    title: optionalString(body.title, 'title'),
    goalType: optionalString(body.goalType, 'goalType'),
    specRef: body.specRef === undefined ? undefined : optionalString(body.specRef, 'specRef'),
    specJson: body.specJson === undefined ? undefined : optionalObject(body.specJson, 'specJson'),
    archived: optionalBoolean(body.archived, 'archived')
  };
}
