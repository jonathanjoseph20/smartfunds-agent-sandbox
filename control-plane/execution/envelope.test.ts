import { describe, expect, it } from 'vitest';

import { buildExecutionEnvelope, computeEnvelopeHash, assertEnvelopeHashMatch } from './envelope.ts';

describe('execution envelope', () => {
  it('locks explicit normalizedFailureSignature null semantics and hash stability', () => {
    const envelope = buildExecutionEnvelope({
      runInput: { projectId: 'core-app', swarmId: 'dev-team', runIndex: 1 },
      resolvedTeam: 'dev-team',
      executionMode: 'structured',
      impliedTier: 3,
      declaredTier: 3,
      normalizedFailureSignature: null
    });

    expect(envelope).toMatchInlineSnapshot(`
      {
        "declaredTier": 3,
        "executionMode": "structured",
        "impliedTier": 3,
        "normalizedFailureSignature": null,
        "resolvedTeam": "dev-team",
        "runInput": {
          "projectId": "core-app",
          "runIndex": 1,
          "swarmId": "dev-team",
        },
      }
    `);

    const first = computeEnvelopeHash(envelope);
    const second = computeEnvelopeHash(envelope);
    expect(first).toBe(second);
  });

  it('rejects mutation envelope hash mismatches deterministically', () => {
    expect(() => assertEnvelopeHashMatch('abc', 'xyz')).toThrowError('Envelope hash mismatch: expected=abc received=xyz');

    try {
      assertEnvelopeHashMatch('abc', 'xyz');
    } catch (error) {
      expect((error as { code?: string }).code).toBe('ERR_ENVELOPE_HASH_MISMATCH');
    }
  });
});
