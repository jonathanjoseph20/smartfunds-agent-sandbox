import { describe, expect, it } from 'vitest';

import { parseEvidenceFileContent } from './evidence-file.ts';

describe('parseEvidenceFileContent', () => {
  it('parses canonical evidence file content', () => {
    const result = parseEvidenceFileContent(`Risk Tier: 2
Justification: Medium change
Affected Paths: packages/mission-engine/src/state.ts
Tests Added: npm test
Determinism Statement: Stable ordering only`);

    expect(result.formatErrors).toEqual([]);
    expect(result.requiredMissing).toEqual([]);
    expect(result.unsupportedKeys).toEqual([]);
    expect(result.kv['Risk Tier']).toBe('2');
  });

  it('reports unsupported keys and format errors deterministically', () => {
    const result = parseEvidenceFileContent(`Risk Tier: 2
Tests: npm test
Determinism: stable
Justification only
Tests: duplicate`);

    expect(result.formatErrors).toEqual(['DUPLICATE_KEY:Tests', 'INVALID_KV_LINE:4']);
    expect(result.unsupportedKeys).toEqual(['Determinism', 'Tests']);
    expect(result.requiredMissing).toEqual([
      'Affected Paths',
      'Determinism Statement',
      'Justification',
      'Tests Added'
    ]);
  });
});
