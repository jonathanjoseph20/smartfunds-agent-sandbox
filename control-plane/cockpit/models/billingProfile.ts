import { ValidationError, optionalBoolean, optionalIdempotencyKey, optionalString, requireObject, requireString } from './_common.ts';

export interface BillingProfile {
  billingProfileId: string;
  entityId: string;
  projectId: string;
  label: string;
  status: 'active' | 'disabled';
  archivedAt: string | null;
}

export interface CreateBillingProfileInput {
  label: string;
  status: 'active' | 'disabled';
  idempotencyKey: string | null;
}

export interface PatchBillingProfileInput {
  status: 'active' | 'disabled' | null;
  archived: boolean | null;
}

export function parseCreateBillingProfileInput(value: unknown): CreateBillingProfileInput {
  const body = requireObject(value, 'request body must be an object');
  const status = optionalString(body.status, 'status') ?? 'active';
  if (status !== 'active' && status !== 'disabled') {
    throw new ValidationError('status must be active or disabled');
  }

  return {
    label: requireString(body.label, 'label'),
    status,
    idempotencyKey: optionalIdempotencyKey(body.idempotencyKey)
  };
}

export function parsePatchBillingProfileInput(value: unknown): PatchBillingProfileInput {
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
    archived: optionalBoolean(body.archived, 'archived')
  };
}
