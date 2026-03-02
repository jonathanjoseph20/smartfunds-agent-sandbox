import { ValidationError, optionalObject, optionalString, requireObject, requireString } from './_common.ts';

export interface RailBinding {
  railBindingId: string;
  billingProfileId: string;
  railType: string;
  status: 'active' | 'disabled';
  externalRef: string | null;
  metadataJson: string | null;
}

export interface CreateRailBindingInput {
  railType: string;
  status: 'active' | 'disabled';
  externalRef: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PatchRailBindingInput {
  status: 'active' | 'disabled' | null;
  externalRef: string | null | undefined;
  metadata: Record<string, unknown> | null | undefined;
}

export function parseCreateRailBindingInput(value: unknown): CreateRailBindingInput {
  const body = requireObject(value, 'request body must be an object');
  const status = optionalString(body.status, 'status') ?? 'active';
  if (status !== 'active' && status !== 'disabled') {
    throw new ValidationError('status must be active or disabled');
  }

  return {
    railType: requireString(body.railType, 'railType'),
    status,
    externalRef: optionalString(body.externalRef, 'externalRef'),
    metadata: optionalObject(body.metadata, 'metadata')
  };
}

export function parsePatchRailBindingInput(value: unknown): PatchRailBindingInput {
  const body = requireObject(value, 'request body must be an object');
  const statusValue = body.status;
  let status: 'active' | 'disabled' | null = null;
  if (statusValue !== undefined && statusValue !== null) {
    if (statusValue !== 'active' && statusValue !== 'disabled') {
      throw new ValidationError('status must be active or disabled');
    }
    status = statusValue;
  }

  return {
    status,
    externalRef: body.externalRef === undefined ? undefined : optionalString(body.externalRef, 'externalRef'),
    metadata: body.metadata === undefined ? undefined : optionalObject(body.metadata, 'metadata')
  };
}
