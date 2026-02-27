import { describe, expect, it } from 'vitest';

import { patchPrBody } from './pr-body-patcher.ts';

describe('pr body patcher', () => {
  it('adds missing tier line and evidence block', () => {
    const result = patchPrBody('Just notes', 3);

    expect(result.changed).toBe(true);
    expect(result.patchedBody.startsWith('tier-3\n\n')).toBe(true);
    expect(result.patchedBody).toContain('```evidence');
    expect(result.patchedBody).toContain('Risk Tier: 3');
    expect(result.addedFields).toEqual([
      'Affected Paths',
      'Determinism Statement',
      'Justification',
      'Risk Tier',
      'Tests Added'
    ]);
  });

  it('adds only missing evidence fields in deterministic order', () => {
    const body = `tier-2

\`\`\`evidence
Risk Tier: 2
Justification: existing
\`\`\``;
    const result = patchPrBody(body, 2);

    expect(result.changed).toBe(true);
    expect(result.patchedBody).toContain('Risk Tier: 2');
    expect(result.patchedBody).toContain('Justification: existing');
    expect(result.patchedBody).toContain('Affected Paths: N/A (metadata-only remediation)');
    expect(result.patchedBody).toContain('Tests Added: N/A (metadata-only remediation)');
    expect(result.patchedBody).toContain(
      'Determinism Statement: Deterministic metadata patch; no timestamps, UUIDs, or randomness.'
    );
    expect(result.addedFields).toEqual(['Affected Paths', 'Determinism Statement', 'Tests Added']);
  });

  it('preserves existing non-empty evidence values', () => {
    const body = `tier-1

\`\`\`evidence
Risk Tier: 1
Justification: keep this
Affected Paths: path/a.ts
Tests Added: already ran
Determinism Statement: existing text
\`\`\``;
    const result = patchPrBody(body, 1);

    expect(result.changed).toBe(false);
    expect(result.patchedBody).toContain('Justification: keep this');
    expect(result.patchedBody).toContain('Affected Paths: path/a.ts');
    expect(result.addedFields).toEqual([]);
  });
});
