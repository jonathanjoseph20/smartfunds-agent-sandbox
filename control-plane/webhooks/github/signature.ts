import { createHmac, timingSafeEqual } from 'node:crypto';

export class GithubSignatureError extends Error {
  public readonly code: 'unauthorized: missing_signature' | 'unauthorized: invalid_signature';
  public readonly statusCode: 401;

  constructor(code: GithubSignatureError['code']) {
    super(code);
    this.name = 'GithubSignatureError';
    this.code = code;
    this.statusCode = 401;
  }
}

function computeExpectedSignature(secret: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
}

function isValidSignatureHeader(value: string): boolean {
  return /^sha256=[0-9a-f]{64}$/i.test(value.trim());
}

function secureCompare(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyGithubSignature(input: {
  secret: string;
  rawBody: string;
  signatureHeader: string | undefined;
}): { ok: true } {
  const header = input.signatureHeader?.trim();
  if (!header) {
    throw new GithubSignatureError('unauthorized: missing_signature');
  }

  if (!isValidSignatureHeader(header)) {
    throw new GithubSignatureError('unauthorized: invalid_signature');
  }

  const expected = computeExpectedSignature(input.secret, input.rawBody);
  if (!secureCompare(expected, header)) {
    throw new GithubSignatureError('unauthorized: invalid_signature');
  }

  return { ok: true };
}
