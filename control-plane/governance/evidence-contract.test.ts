import { describe, expect, it } from 'vitest';

import {
  readEvidenceContract,
  validateEvidenceAgainstComputedState,
  type GovernanceEvidence
} from './evidence-contract.ts';

const VALID_SCHEMA = JSON.stringify({
  type: 'object',
  additionalProperties: false,
  required: [
    'tier',
    'mode',
    'affectedPaths',
    'determinismStatement',
    'retrySemanticsModified',
    'autonomyScopeExpanded'
  ],
  properties: {
    tier: { type: 'number' },
    mode: { type: 'string', enum: ['structured', 'autonomous'] },
    affectedPaths: { type: 'array', items: { type: 'string' } },
    determinismStatement: { type: 'string' },
    retrySemanticsModified: { type: 'boolean' },
    autonomyScopeExpanded: { type: 'boolean' },
    notes: { type: 'string' },
    railImpacted: { type: 'boolean' },
    entityRegistryImpacted: { type: 'boolean' }
  }
});

function readEvidence(content: string) {
  return readEvidenceContract({
    evidencePath: 'governance/evidence.json',
    schemaPath: 'governance/schema/evidence.schema.json',
    existsSync: (filePath) => filePath === 'governance/evidence.json' || filePath === 'governance/schema/evidence.schema.json',
    readFile: (filePath) => (filePath.endsWith('schema/evidence.schema.json') ? VALID_SCHEMA : content)
  });
}

describe('governance evidence contract', () => {
  it('passes with valid evidence json and normalizes affected paths', () => {
    const result = readEvidence(
      JSON.stringify({
        tier: 3,
        mode: 'structured',
        affectedPaths: ['b.ts', 'a.ts', 'a.ts'],
        determinismStatement: 'No identity surfaces mutated.',
        retrySemanticsModified: false,
        autonomyScopeExpanded: false
      })
    );

    expect(result.exists).toBe(true);
    expect('evidence' in result && result.evidence.affectedPaths).toEqual(['a.ts', 'b.ts']);
  });

  it('fails when a required field is missing', () => {
    const result = readEvidence(
      JSON.stringify({
        tier: 3,
        mode: 'structured',
        determinismStatement: 'No identity surfaces mutated.',
        retrySemanticsModified: false,
        autonomyScopeExpanded: false
      })
    );

    expect(result.exists).toBe(true);
    expect('errors' in result && result.errors.join('\n')).toContain('evidence.affectedPaths is required');
  });

  it('fails when an extra property is present', () => {
    const result = readEvidence(
      JSON.stringify({
        tier: 3,
        mode: 'structured',
        affectedPaths: ['a.ts'],
        determinismStatement: 'No identity surfaces mutated.',
        retrySemanticsModified: false,
        autonomyScopeExpanded: false,
        unexpected: true
      })
    );

    expect(result.exists).toBe(true);
    expect('errors' in result && result.errors.join('\n')).toContain('evidence.unexpected is not allowed');
  });

  it('fails when property types are invalid', () => {
    const result = readEvidence(
      JSON.stringify({
        tier: '3',
        mode: 'structured',
        affectedPaths: ['a.ts'],
        determinismStatement: 'No identity surfaces mutated.',
        retrySemanticsModified: false,
        autonomyScopeExpanded: false
      })
    );

    expect(result.exists).toBe(true);
    expect('errors' in result && result.errors.join('\n')).toContain('evidence.tier must be type number');
  });

  it('flags tier/mode/affected-path mismatches', () => {
    const evidence: GovernanceEvidence = {
      tier: 3,
      mode: 'structured',
      affectedPaths: ['control-plane/a.ts'],
      determinismStatement: 'No identity surfaces mutated.',
      retrySemanticsModified: false,
      autonomyScopeExpanded: false
    };

    const errors = validateEvidenceAgainstComputedState({
      evidence,
      changedFiles: ['control-plane/b.ts'],
      labelTier: 2,
      impliedMode: 'autonomous'
    });

    expect(errors).toEqual([
      'Affected paths mismatch: governance/evidence.json must exactly match changed files. expected=["control-plane/b.ts"] actual=["control-plane/a.ts"]',
      'Execution mode mismatch: implied mode is autonomous; governance/evidence.json mode must be autonomous.',
      'Risk tier mismatch: label tier is 2; governance/evidence.json tier must be 2.'
    ]);
  });
});
