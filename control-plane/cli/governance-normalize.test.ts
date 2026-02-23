import { describe, expect, it } from 'vitest';

import { normalizeBody } from './governance-normalize';

describe('governance:normalize', () => {
  it('normalizes evidence block and whitespace deterministically', () => {
    const input =
      'tier-2 \r\n' +
      '\r\n' +
      'tier-1\r\n' +
      '   ```evidence\r\n' +
      'Risk Tier: 2\r\n' +
      'Justification: ok \r\n' +
      'Extra: keep-me\r\n' +
      '```   \r\n' +
      'Footer line  \r\n';

    const result = normalizeBody(input);

    expect(result.normalized).toMatchInlineSnapshot(`"tier-2\n\n\`\`\`evidence\nRisk Tier: 2\nJustification: ok\nAffected Paths: <placeholder>\nTests Added: <placeholder>\nDeterminism Statement: Deterministic; no randomness, no hidden mutation, sorted output.\n\nExtra: keep-me\n\`\`\`\n\nFooter line"`);
    expect(result.removedTierLines).toBe(1);
  });

  it('inserts missing tier and evidence block when absent', () => {
    const result = normalizeBody('');

    expect(result.normalized).toMatchInlineSnapshot(`"tier-0\n\n\`\`\`evidence\nRisk Tier: 0\nJustification: <placeholder>\nAffected Paths: <placeholder>\nTests Added: <placeholder>\nDeterminism Statement: Deterministic; no randomness, no hidden mutation, sorted output.\n\`\`\`"`);
    expect(result.insertedTierLine).toBe(true);
    expect(result.hadEvidenceBlock).toBe(false);
  });
});
