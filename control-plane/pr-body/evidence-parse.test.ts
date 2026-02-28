import { describe, expect, it } from 'vitest';

import { parsePrBodyForGovernance } from './evidence-parse.ts';

const validBody = `tier-2

\`\`\`evidence
Risk Tier: 2
Justification: Governance enforcement
Affected Paths: control-plane/governance/validate.ts
Tests Added: npx vitest run control-plane/pr-body/*.test.ts
Determinism Statement: Pure functions and stable sorting.
\`\`\``;

describe('parsePrBodyForGovernance', () => {
  it('parses valid tier + evidence data', () => {
    const parsed = parsePrBodyForGovernance(validBody);
    expect(parsed.tierLine).toBe('tier-2');
    expect(parsed.evidenceFound).toBe(true);
    expect(parsed.kv['Risk Tier']).toBe('2');
    expect(parsed.requiredMissing).toEqual([]);
    expect(parsed.unsupportedKeys).toEqual([]);
    expect(parsed.formatErrors).toEqual([]);
  });

  it('returns null tier when missing', () => {
    const parsed = parsePrBodyForGovernance(validBody.replace('tier-2\n\n', ''));
    expect(parsed.tierLine).toBeNull();
    expect(parsed.formatErrors).toEqual([]);
  });

  it('flags invalid tier labels', () => {
    const parsed = parsePrBodyForGovernance(validBody.replace('tier-2', 'tier-4'));
    expect(parsed.tierLine).toBeNull();
    expect(parsed.formatErrors).toContain('INVALID_TIER_LABEL:tier-4');
  });

  it('detects missing evidence block', () => {
    const parsed = parsePrBodyForGovernance('tier-1\n\nNo evidence block');
    expect(parsed.evidenceFound).toBe(false);
    expect(parsed.requiredMissing).toEqual([
      'Affected Paths',
      'Determinism Statement',
      'Justification',
      'Risk Tier',
      'Tests Added'
    ]);
  });

  it('detects unclosed evidence fence', () => {
    const parsed = parsePrBodyForGovernance(validBody.replace(/\n```$/, ''));
    expect(parsed.evidenceFound).toBe(false);
    expect(parsed.formatErrors).toContain('UNCLOSED_EVIDENCE_BLOCK');
  });

  it('detects unsupported keys', () => {
    const parsed = parsePrBodyForGovernance(validBody.replace('Tests Added', 'Tests').replace('Determinism Statement', 'Determinism'));
    expect(parsed.unsupportedKeys).toEqual(['Determinism', 'Tests']);
  });

  it('records duplicate key format errors', () => {
    const withDuplicate = validBody.replace(
      'Determinism Statement: Pure functions and stable sorting.',
      `Determinism Statement: Pure functions and stable sorting.\nRisk Tier: 2`
    );
    const parsed = parsePrBodyForGovernance(withDuplicate);
    expect(parsed.formatErrors).toContain('DUPLICATE_KEY:Risk Tier');
    expect(parsed.kv['Risk Tier']).toBe('2');
  });

  it('sorts and dedupes list fields deterministically', () => {
    const parsed = parsePrBodyForGovernance(`tier-4

\`\`\`evidence
Determinism: no
Tests: no
Tests: yes
Justification only
\`\`\``);

    expect(parsed.formatErrors).toEqual([
      'DUPLICATE_KEY:Tests',
      'INVALID_KV_LINE:7',
      'INVALID_TIER_LABEL:tier-4'
    ]);
    expect(parsed.unsupportedKeys).toEqual(['Determinism', 'Tests']);
    expect(parsed.requiredMissing).toEqual([
      'Affected Paths',
      'Determinism Statement',
      'Justification',
      'Risk Tier',
      'Tests Added'
    ]);
  });
});
