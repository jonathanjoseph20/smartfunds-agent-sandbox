import type { SlackActionPayload } from './types.ts';

function parseRunIdToken(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('runId:')) {
    const runId = trimmed.slice('runId:'.length).trim();
    return runId.length > 0 ? runId : null;
  }

  if (trimmed.startsWith('retry:')) {
    const runId = trimmed.slice('retry:'.length).trim();
    return runId.length > 0 ? runId : null;
  }

  return trimmed;
}

export function extractRunIdFromSlackActionPayload(payload: SlackActionPayload): string | null {
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  for (const action of actions) {
    const fromValue = parseRunIdToken(action?.value);
    if (fromValue) {
      return fromValue;
    }

    const fromActionId = parseRunIdToken(action?.action_id);
    if (fromActionId) {
      return fromActionId;
    }
  }

  return null;
}
