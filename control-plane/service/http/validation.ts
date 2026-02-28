import type { ExecuteRequestBody, ValidationError } from './types.ts';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateExecuteRequestBody(value: unknown): { ok: true; value: ExecuteRequestBody } | { ok: false; error: ValidationError } {
  if (!isPlainObject(value)) {
    return { ok: false, error: { error: 'INVALID_REQUEST_BODY' } };
  }

  const swarmId = value.swarmId;
  const projectId = value.projectId;
  const mode = value.mode;
  const intent = value.intent;

  if (!isNonEmptyString(swarmId)) {
    return { ok: false, error: { error: 'INVALID_ARGUMENT: swarmId' } };
  }
  if (!isNonEmptyString(projectId)) {
    return { ok: false, error: { error: 'INVALID_ARGUMENT: projectId' } };
  }
  if (mode !== 'structured' && mode !== 'autonomous') {
    return { ok: false, error: { error: 'INVALID_ARGUMENT: mode' } };
  }
  if (!isNonEmptyString(intent)) {
    return { ok: false, error: { error: 'INVALID_ARGUMENT: intent' } };
  }

  return {
    ok: true,
    value: {
      swarmId,
      projectId,
      mode,
      intent
    }
  };
}

export function validateWebhookSource(source: string | undefined): { ok: true; source: string } | { ok: false; error: ValidationError } {
  if (!source || source.trim().length === 0) {
    return {
      ok: false,
      error: { error: 'INVALID_ARGUMENT: source' }
    };
  }

  return {
    ok: true,
    source: source.trim()
  };
}
