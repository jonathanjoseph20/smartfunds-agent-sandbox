import { createHmac, timingSafeEqual } from 'node:crypto';

export const SLACK_SIGNATURE_VERSION = 'v0';
export const DEFAULT_SLACK_TOLERANCE_SECONDS = 60 * 5;

export class SlackSignatureError extends Error {
  public readonly code: 'SLACK_SIGNATURE_MISSING' | 'SLACK_SIGNATURE_INVALID' | 'SLACK_SIGNATURE_STALE';
  public readonly statusCode: 401;

  constructor(code: SlackSignatureError['code'], message: string) {
    super(message);
    this.name = 'SlackSignatureError';
    this.code = code;
    this.statusCode = 401;
  }
}

function computeSlackSignature(signingSecret: string, timestamp: string, rawBody: string): string {
  const baseString = `${SLACK_SIGNATURE_VERSION}:${timestamp}:${rawBody}`;
  const digest = createHmac('sha256', signingSecret).update(baseString).digest('hex');
  return `${SLACK_SIGNATURE_VERSION}=${digest}`;
}

function secureCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifySlackSignature(input: {
  signingSecret: string;
  rawBody: string;
  slackSignatureHeader: string | undefined;
  slackTimestampHeader: string | undefined;
  nowSeconds?: () => number;
  toleranceSeconds?: number;
}): { ok: true } {
  const signature = input.slackSignatureHeader?.trim();
  const timestamp = input.slackTimestampHeader?.trim();

  if (!signature || !timestamp) {
    throw new SlackSignatureError('SLACK_SIGNATURE_MISSING', 'Missing Slack signature headers.');
  }

  const nowSeconds = input.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const toleranceSeconds = input.toleranceSeconds ?? DEFAULT_SLACK_TOLERANCE_SECONDS;

  const timestampNumber = Number.parseInt(timestamp, 10);
  if (Number.isNaN(timestampNumber) || Math.abs(nowSeconds() - timestampNumber) > toleranceSeconds) {
    throw new SlackSignatureError('SLACK_SIGNATURE_STALE', 'Slack signature timestamp is outside the replay window.');
  }

  const expected = computeSlackSignature(input.signingSecret, timestamp, input.rawBody);
  if (!secureCompare(expected, signature)) {
    throw new SlackSignatureError('SLACK_SIGNATURE_INVALID', 'Slack signature is invalid.');
  }

  return { ok: true };
}
