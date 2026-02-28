import { describe, expect, it } from 'vitest';

import { generateCanonicalPrBody } from './seal-body.ts';

describe('generateCanonicalPrBody', () => {
  it('emits exact canonical body format', () => {
    const body = generateCanonicalPrBody({
      tier: 'tier-3',
      evidence: {
        'Risk Tier': '3',
        'Justification': 'Governance control-plane path touched',
        'Affected Paths': 'control-plane/governance/validate.ts',
        'Tests Added': 'npx vitest run control-plane/pr-body/*.test.ts',
        'Determinism Statement': 'No randomness, no time-based logic, stable sorting.'
      }
    });

    expect(body).toBe(`tier-3

\`\`\`evidence
Risk Tier: 3
Justification: Governance control-plane path touched
Affected Paths: control-plane/governance/validate.ts
Tests Added: npx vitest run control-plane/pr-body/*.test.ts
Determinism Statement: No randomness, no time-based logic, stable sorting.
\`\`\``);
  });

  it('keeps required keys in canonical order with exact fences', () => {
    const body = generateCanonicalPrBody({
      tier: 'tier-0',
      evidence: {
        'Risk Tier': '0',
        'Justification': 'Docs only',
        'Affected Paths': 'docs/governance.md',
        'Tests Added': 'N/A',
        'Determinism Statement': 'Static content'
      }
    });

    const lines = body.split('\n');
    expect(lines[2]).toBe('```evidence');
    expect(lines[3]).toBe('Risk Tier: 0');
    expect(lines[4]).toBe('Justification: Docs only');
    expect(lines[5]).toBe('Affected Paths: docs/governance.md');
    expect(lines[6]).toBe('Tests Added: N/A');
    expect(lines[7]).toBe('Determinism Statement: Static content');
    expect(lines[8]).toBe('```');
  });
});
