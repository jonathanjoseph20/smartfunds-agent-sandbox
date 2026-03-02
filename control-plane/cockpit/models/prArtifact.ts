import { optionalObject, optionalString, requireObject, requireString } from './_common.ts';

export interface PRArtifact {
  artifactId: string;
  projectId: string;
  runId: string;
  attemptIndex: number;
  kind: string;
  status: string;
  externalUrl: string | null;
  externalRef: string | null;
  metadataJson: string | null;
}

export interface CreateArtifactInput {
  kind: string;
  status: string;
  externalUrl: string | null;
  externalRef: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PatchArtifactInput {
  status: string | null;
  externalUrl: string | null | undefined;
  externalRef: string | null | undefined;
  metadata: Record<string, unknown> | null | undefined;
}

export function parseCreateArtifactInput(value: unknown): CreateArtifactInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    kind: requireString(body.kind, 'kind'),
    status: optionalString(body.status, 'status') ?? 'planned',
    externalUrl: optionalString(body.externalUrl, 'externalUrl'),
    externalRef: optionalString(body.externalRef, 'externalRef'),
    metadata: optionalObject(body.metadata, 'metadata')
  };
}

export function parsePatchArtifactInput(value: unknown): PatchArtifactInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    status: optionalString(body.status, 'status'),
    externalUrl: body.externalUrl === undefined ? undefined : optionalString(body.externalUrl, 'externalUrl'),
    externalRef: body.externalRef === undefined ? undefined : optionalString(body.externalRef, 'externalRef'),
    metadata: body.metadata === undefined ? undefined : optionalObject(body.metadata, 'metadata')
  };
}
