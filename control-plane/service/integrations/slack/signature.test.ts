import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifySlackSignature } from './signature.ts';

function sign(secret: string, timestamp: string, body: string): string {
  const digest = createHmac('sha256', secret)
    .update(`v0:${timestamp}:${body}`)
    .digest('hex');
  return `v0=${digest}`;
}

describe('slack signature verification', () => {
  it('passes for valid signature', () => {
    const signingSecret = 'test-secret';
    const timestamp = '1700000000';
    const rawBody = 'payload=%7B%22type%22%3A%22block_actions%22%7D';
    const slackSignatureHeader = sign(signingSecret, timestamp, rawBody);

    const result = verifySlackSignature({
      signingSecret,
      rawBody,
      slackSignatureHeader,
      slackTimestampHeader: timestamp,
      nowSeconds: () => 1700000000
    });

    expect(result).toEqual({ ok: true });
  });

  it('fails for invalid signature', () => {
    expect(() => verifySlackSignature({
      signingSecret: 'test-secret',
      rawBody: 'payload=%7B%7D',
      slackSignatureHeader: 'v0=deadbeef',
      slackTimestampHeader: '1700000000',
      nowSeconds: () => 1700000000
    })).toThrowError('Slack signature is invalid.');
  });

  it('fails for stale timestamp', () => {
    const signingSecret = 'test-secret';
    const timestamp = '1690000000';
    const rawBody = 'payload=%7B%7D';

    expect(() => verifySlackSignature({
      signingSecret,
      rawBody,
      slackSignatureHeader: sign(signingSecret, timestamp, rawBody),
      slackTimestampHeader: timestamp,
      nowSeconds: () => 1700000000
    })).toThrowError('Slack signature timestamp is outside the replay window.');
  });
});
