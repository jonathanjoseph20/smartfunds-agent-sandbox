import { describe, expect, it } from 'vitest';

import { scanCommentsForEvidence } from './comment-scan.ts';

describe('scanCommentsForEvidence', () => {
  it('detects legacy governance metadata when tier line and evidence fence are both present', () => {
    const result = scanCommentsForEvidence([
      {
        id: 11,
        body: 'tier-2\n\n```evidence\nRisk Tier: 2\n```'
      }
    ]);

    expect(result).toEqual({ detected: true, count: 1, commentIds: [11] });
  });

  it('detects legacy tier-only metadata', () => {
    const result = scanCommentsForEvidence([{ id: 2, body: 'tier-1\nThis is text only' }]);
    expect(result).toEqual({ detected: true, count: 1, commentIds: [2] });
  });

  it('detects legacy evidence-only metadata', () => {
    const result = scanCommentsForEvidence([{ id: 3, body: '```evidence\nRisk Tier: 1\n```' }]);
    expect(result).toEqual({ detected: true, count: 1, commentIds: [3] });
  });

  it('returns deterministic count and sorted ids across multiple comments', () => {
    const result = scanCommentsForEvidence([
      { id: 9, body: 'tier-0\n\n```evidence\nRisk Tier: 0\n```' },
      { id: 4, body: 'tier-3\n\n```evidence\nRisk Tier: 3\n```' },
      { id: 7, body: 'no governance payload' }
    ]);

    expect(result).toEqual({ detected: true, count: 2, commentIds: [4, 9] });
  });
});
