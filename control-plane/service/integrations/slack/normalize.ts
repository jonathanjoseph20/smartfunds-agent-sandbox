import { canonicalStringify, sha256 } from '../../../finance/determinism.ts';
import type { SlackActionPayload, SlackEventEnvelope, SlackWebhookType } from './types.ts';

function normalizeActions(actions: SlackActionPayload['actions']): Array<{ action_id: string | null; value: string | null }> {
  if (!Array.isArray(actions)) {
    return [];
  }
  return actions.map((action) => ({
    action_id: action?.action_id ?? null,
    value: action?.value ?? null
  }));
}

export function parseSlackActionPayload(rawBody: string): SlackActionPayload | null {
  const form = new URLSearchParams(rawBody);
  const payloadRaw = form.get('payload');
  if (!payloadRaw) {
    return null;
  }

  try {
    return JSON.parse(payloadRaw) as SlackActionPayload;
  } catch {
    return null;
  }
}

export function parseSlackEventEnvelope(rawBody: string): SlackEventEnvelope | null {
  try {
    return JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return null;
  }
}

export function normalizeSlackActionPayload(payload: SlackActionPayload): Record<string, unknown> {
  return {
    type: payload.type ?? null,
    team: {
      id: payload.team?.id ?? null
    },
    user: {
      id: payload.user?.id ?? null
    },
    actions: normalizeActions(payload.actions),
    channel: {
      id: payload.channel?.id ?? null
    },
    message: {
      ts: payload.message?.ts ?? null
    }
  };
}

export function normalizeSlackEventEnvelope(payload: SlackEventEnvelope): Record<string, unknown> {
  return {
    type: payload.type ?? null,
    event_id: payload.event_id ?? null,
    team_id: payload.team_id ?? null,
    event: {
      type: payload.event?.type ?? null,
      user: payload.event?.user ?? null,
      channel: payload.event?.channel ?? null,
      ts: payload.event?.ts ?? null
    }
  };
}

export function computeSlackWebhookEventId(input: {
  webhookType: SlackWebhookType;
  normalizedPayload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    type: input.webhookType,
    payload: input.normalizedPayload
  }));
}
