import { describe, expect, it } from 'vitest';

import { assertEnvelopeHashMatch, buildEnvelopeIdentityV1, computeEnvelopeHash, computeRunId } from './envelope.ts';

describe('execution envelope', () => {
  it('sorts changed paths and computes stable envelope hash', () => {
    const envelope = buildEnvelopeIdentityV1({
      triggerType: 'manual',
      repo: { owner: 'smartfunds', name: 'sandbox' },
      ref: { base: 'main', head: 'feature/x' },
      changedPaths: ['b/file.ts', 'a/file.ts', 'a/file.ts'],
      declaredTier: 3,
      impliedTier: 3,
      executionMode: 'structured',
      errorClass: null,
      failureSignature: null
    }, {
      loadProjects: () => [{ projectId: 'core-app', ownedPaths: ['a/**', 'b/**'] }],
      loadTeams: () => [{ teamId: 'dev-team', projectId: 'core-app', ownedPaths: ['a/**', 'b/**'] }],
      resolveOwnership: () => ({
        projectsTouched: ['core-app'],
        teamsTouched: ['dev-team'],
        unownedFiles: [],
        ownershipStatus: 'ok',
        nextActions: []
      })
    });

    expect(envelope.diff.changedPaths).toEqual(['a/file.ts', 'b/file.ts']);
    const first = computeEnvelopeHash(envelope);
    const second = computeEnvelopeHash(envelope);
    expect(first).toBe(second);
    expect(computeRunId(first)).toBe(computeRunId(second));
  });

  it('short-circuits diff resolution for no-work envelopes', () => {
    const envelope = buildEnvelopeIdentityV1({
      triggerType: 'preflight',
      repo: { owner: 'smartfunds', name: 'sandbox' },
      ref: { base: 'main', head: 'HEAD' },
      changedPaths: [],
      declaredTier: 0,
      impliedTier: 0,
      executionMode: 'structured'
    }, {
      resolveOwnership: () => {
        throw new Error('should_not_resolve_ownership');
      }
    });

    expect(envelope.diff.ownershipStatus).toBe('no_work');
    expect(envelope.diff.projectIdsTouched).toEqual([]);
    expect(envelope.diff.teamIdsTouched).toEqual([]);
  });

  it('rejects mutation envelope hash mismatches deterministically', () => {
    expect(() => assertEnvelopeHashMatch('abc', 'xyz')).toThrowError('Envelope hash mismatch: expected=abc received=xyz');
  });
});
