import type { ErrorClass } from '../../../execution/error-classification.ts';
import { isRetryEligible } from '../../../execution/retry.ts';
import type { RunLifecycleState } from '../../../execution/run-lifecycle.ts';
import type { RunRecord } from '../../../execution/types.ts';
import { canonicalStringify, sha256 } from '../../../finance/determinism.ts';
import type { SlackLifecycleNotificationOptions, SlackNotifier } from './types.ts';

const SLACK_API_POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';

function shortHash(value: string): string {
  return value.slice(0, 12);
}

function shortRunId(runId: string): string {
  return runId.slice(0, 8);
}

function parseEnvelope(run: RunRecord): {
  repo?: { owner: string; name: string };
  ref?: { base: string; head: string };
  policy?: { declaredTier: number; impliedTier: number };
  diff?: { ownershipStatus: 'ok' | 'no_work' | 'violation' };
} {
  try {
    return JSON.parse(run.envelopeCanonical) as {
      repo?: { owner: string; name: string };
      ref?: { base: string; head: string };
      policy?: { declaredTier: number; impliedTier: number };
      diff?: { ownershipStatus: 'ok' | 'no_work' | 'violation' };
    };
  } catch {
    return {};
  }
}

function findFailureForAttempt(run: RunRecord, attemptIndex: number): { errorClass: ErrorClass; failureSignature?: string } | null {
  const failed = [...run.events]
    .reverse()
    .find((event) => event.eventType === 'STATE_TRANSITION' && event.attemptIndex === attemptIndex && event.nextState === 'FAILED');

  if (!failed?.errorClass) {
    return null;
  }

  return {
    errorClass: failed.errorClass,
    failureSignature: failed.failureSignature
  };
}

export function isRetryButtonEligible(run: RunRecord): boolean {
  if (run.latestState !== 'FAILED') {
    return false;
  }

  if (run.attempts.some((attempt) => attempt.attemptIndex === 1)) {
    return false;
  }

  const envelope = parseEnvelope(run);
  const failure = findFailureForAttempt(run, 0);
  if (!failure?.errorClass) {
    return false;
  }

  return isRetryEligible({
    attemptIndex: 0,
    errorClass: failure.errorClass,
    ownershipStatus: envelope.diff?.ownershipStatus ?? 'violation',
    declaredTier: envelope.policy?.declaredTier ?? -1,
    impliedTier: envelope.policy?.impliedTier ?? -2
  });
}

function findAttemptIndexForState(run: RunRecord, state: RunLifecycleState): number {
  const match = [...run.events]
    .reverse()
    .find((event) => event.eventType === 'STATE_TRANSITION' && event.nextState === state);
  return match?.attemptIndex ?? 0;
}

function buildDetailLines(run: RunRecord, state: RunLifecycleState, serviceBaseUrl?: string): string[] {
  const envelope = parseEnvelope(run);
  const attemptIndex = findAttemptIndexForState(run, state);
  const failure = state === 'FAILED' || state === 'RETRY_FAILED'
    ? findFailureForAttempt(run, attemptIndex)
    : null;

  const repoRef = envelope.repo && envelope.ref
    ? `${envelope.repo.owner}/${envelope.repo.name} @ ${envelope.ref.head}`
    : null;

  const lines = [
    `repo/ref: ${repoRef ?? 'n/a'}`,
    `attemptIndex: ${String(attemptIndex)}`,
    `errorClass: ${failure?.errorClass ?? 'n/a'}`,
    `failureSignatureShort: ${failure?.failureSignature ? shortHash(failure.failureSignature) : 'n/a'}`,
    `envelopeHashShort: ${shortHash(run.envelopeHash)}`
  ];

  if (serviceBaseUrl && serviceBaseUrl.trim().length > 0) {
    lines.push(`links: ${serviceBaseUrl.replace(/\/$/, '')}/run/${run.runId}`);
  }

  return lines;
}

export function buildLifecycleNotificationId(input: {
  runId: string;
  state: RunLifecycleState;
  attemptIndex: number;
}): string {
  return sha256(canonicalStringify({
    kind: 'slack_lifecycle',
    runId: input.runId,
    state: input.state,
    attemptIndex: input.attemptIndex
  }));
}

export function buildLifecycleSlackMessage(
  run: RunRecord,
  state: RunLifecycleState,
  options: SlackLifecycleNotificationOptions = {}
): {
  text: string;
  blocks: Array<Record<string, unknown>>;
  attemptIndex: number;
} {
  const attemptIndex = findAttemptIndexForState(run, state);
  const text = `Run ${shortRunId(run.runId)} - ${state}`;
  const detailLines = buildDetailLines(run, state, options.serviceBaseUrl);
  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${text}*`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: detailLines.map((line) => `- ${line}`).join('\n')
      }
    }
  ];

  if (state === 'FAILED' && options.retryEligible) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Retry'
          },
          action_id: 'retry_run',
          value: `runId:${run.runId}`
        }
      ]
    });
  }

  return { text, blocks, attemptIndex };
}

export class SlackNotificationError extends Error {
  public readonly code:
    | 'SLACK_NOT_CONFIGURED'
    | 'SLACK_CHANNEL_NOT_CONFIGURED'
    | 'SLACK_POST_FAILED'
    | 'SLACK_RESPONSE_INVALID';

  constructor(code: SlackNotificationError['code'], message: string) {
    super(message);
    this.name = 'SlackNotificationError';
    this.code = code;
  }
}

interface SlackNotifierConfig {
  botToken?: string;
  webhookUrl?: string;
  defaultChannel?: string;
}

export function createSlackNotifier(config: SlackNotifierConfig): SlackNotifier {
  async function postViaBotToken(channel: string, payload: { text: string; blocks: Array<Record<string, unknown>> }): Promise<void> {
    const response = await fetch(SLACK_API_POST_MESSAGE_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.botToken ?? ''}`,
        'content-type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        channel,
        text: payload.text,
        blocks: payload.blocks
      })
    });

    if (!response.ok) {
      throw new SlackNotificationError('SLACK_POST_FAILED', `Slack API returned HTTP ${String(response.status)}.`);
    }

    const body = await response.json() as { ok?: boolean; error?: string };
    if (!body.ok) {
      throw new SlackNotificationError('SLACK_RESPONSE_INVALID', `Slack API error: ${body.error ?? 'unknown_error'}.`);
    }
  }

  async function postViaWebhook(payload: { text: string; blocks: Array<Record<string, unknown>> }): Promise<void> {
    const response = await fetch(config.webhookUrl ?? '', {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new SlackNotificationError('SLACK_POST_FAILED', `Slack webhook returned HTTP ${String(response.status)}.`);
    }
  }

  return {
    async postLifecycleNotification(runSummary, state, options = {}) {
      const message = buildLifecycleSlackMessage(runSummary, state, options);

      if (config.botToken && config.botToken.trim().length > 0) {
        const channel = config.defaultChannel?.trim();
        if (!channel) {
          throw new SlackNotificationError('SLACK_CHANNEL_NOT_CONFIGURED', 'Slack default channel is required for bot token posting.');
        }

        await postViaBotToken(channel, message);
        return { ok: true };
      }

      if (config.webhookUrl && config.webhookUrl.trim().length > 0) {
        await postViaWebhook(message);
        return { ok: true };
      }

      throw new SlackNotificationError('SLACK_NOT_CONFIGURED', 'Slack bot token or webhook URL is required.');
    }
  };
}
