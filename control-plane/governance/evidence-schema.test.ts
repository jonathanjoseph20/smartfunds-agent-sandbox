import { describe, expect, it } from 'vitest';

import { validateEvidenceShape } from './evidence-schema.ts';

describe('governance evidence schema safeguards', () => {
  it('T-E1 rejects nested evidence.evidence payloads', () => {
    const errors = validateEvidenceShape({
      evidence: {
        evidence: {
          tier: 2
        }
      }
    });

    expect(errors).toContain('evidence.evidence is not allowed.');
  });

  it('T-E1 requires canonical evidence fields', () => {
    const errors = validateEvidenceShape({
      tier: 2,
      mode: 'structured'
    });

    expect(errors).toEqual([
      'evidence.affectedPaths is required.',
      'evidence.autonomyScopeExpanded is required.',
      'evidence.determinismStatement is required.',
      'evidence.retrySemanticsModified is required.'
    ]);
  });
});
