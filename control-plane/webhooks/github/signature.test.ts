import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyGithubSignature } from './signature.ts';

function sign(secret: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

describe('verifyGithubSignature', () => {
  it('accepts valid signature', () => {
    const secret = 'test-secret';
    const rawBody = '{"test":1}';

    const result = verifyGithubSignature({
      secret,
      rawBody,
      signatureHeader: sign(secret, rawBody)
    });

    expect(result).toEqual({ ok: true });
  });

  it('rejects missing signature', () => {
    expect(() => verifyGithubSignature({
      secret: 'test-secret',
      rawBody: '{"test":1}',
      signatureHeader: undefined
    })).toThrowError('unauthorized: missing_signature');
  });

  it('rejects malformed signature', () => {
    expect(() => verifyGithubSignature({
      secret: 'test-secret',
      rawBody: '{"test":1}',
      signatureHeader: 'sha256=nope'
    })).toThrowError('unauthorized: invalid_signature');
  });

  it('rejects mismatched signature', () => {
    expect(() => verifyGithubSignature({
      secret: 'test-secret',
      rawBody: '{"test":1}',
      signatureHeader: 'sha256=0000000000000000000000000000000000000000000000000000000000000000'
    })).toThrowError('unauthorized: invalid_signature');
  });
});
