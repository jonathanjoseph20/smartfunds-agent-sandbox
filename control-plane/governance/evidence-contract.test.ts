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
  it('fails with exact error when governance/evidence.json is missing', () => {
    const result = readEvidenceContract({
      evidencePath: 'governance/evidence.json',
      schemaPath: 'governance/schema/evidence.schema.json',
      existsSync: () => false,
      readFile: () => VALID_SCHEMA
    });

    expect(result.exists).toBe(false);
    expect(result.errors).toEqual(['Missing governance/evidence.json']);
  });

  it('fails with deterministic parse error for malformed json', () => {
    const result = readEvidence('{');
    expect(result.exists).toBe(true);
    expect('errors' in result && result.errors[0]).toContain('governance/evidence.json is not valid JSON');
  });

  it('fails when additional properties are present', () => {
    const result = readEvidence(
      JSON.stringify({
        tier: 2,
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

  it('fails when affectedPaths is not sorted', () => {
    const result = readEvidence(
      '{\n' +
      '  "tier": 2,\n' +
      '  "mode": "structured",\n' +
      '  "affectedPaths": ["b.ts", "a.ts"],\n' +
      '  "determinismStatement": "No identity surfaces mutated.",\n' +
      '  "retrySemanticsModified": false,\n' +
      '  "autonomyScopeExpanded": false\n' +
      '}\n'
    );

    expect(result.exists).toBe(true);
    expect('errors' in result && result.errors).toContain(
      'governance/evidence.json contains invalid values after schema validation. Ensure affectedPaths is sorted and non-empty.'
    );
  });

  it('fails when arrays are empty', () => {
    const result = readEvidence(
      '{\n' +
      '  "tier": 2,\n' +
      '  "mode": "structured",\n' +
      '  "affectedPaths": [],\n' +
      '  "determinismStatement": "No identity surfaces mutated.",\n' +
      '  "retrySemanticsModified": false,\n' +
      '  "autonomyScopeExpanded": false\n' +
      '}\n'
    );

    expect(result.exists).toBe(true);
    expect('errors' in result && result.errors.join('\n')).toContain('evidence.affectedPaths must not be empty.');
  });

  it('fails when strings include trailing whitespace', () => {
    const result = readEvidence(
      '{\n' +
      '  "tier": 2,\n' +
      '  "mode": "structured",\n' +
      '  "affectedPaths": ["a.ts"],\n' +
      '  "determinismStatement": "No identity surfaces mutated. ",\n' +
      '  "retrySemanticsModified": false,\n' +
      '  "autonomyScopeExpanded": false\n' +
      '}\n'
    );

    expect(result.exists).toBe(true);
    expect('errors' in result && result.errors.join('\n')).toContain(
      'evidence.determinismStatement must not have trailing whitespace.'
    );
  });

  it('fails when file contains CRLF line endings', () => {
    const result = readEvidence(
      '{\r\n' +
      '  "tier": 2,\r\n' +
      '  "mode": "structured",\r\n' +
      '  "affectedPaths": ["a.ts"],\r\n' +
      '  "determinismStatement": "No identity surfaces mutated.",\r\n' +
      '  "retrySemanticsModified": false,\r\n' +
      '  "autonomyScopeExpanded": false\r\n' +
      '}\r\n'
    );

    expect(result.exists).toBe(true);
    expect('errors' in result && result.errors).toEqual(['governance/evidence.json must use LF line endings only.']);
  });

  it('flags tier/mode/affected-path mismatches using sorted comparisons', () => {
    const evidence: GovernanceEvidence = {
      tier: 3,
      mode: 'structured',
      affectedPaths: ['control-plane/b.ts', 'control-plane/a.ts'],
      determinismStatement: 'No identity surfaces mutated.',
      retrySemanticsModified: false,
      autonomyScopeExpanded: false
    };

    const errors = validateEvidenceAgainstComputedState({
      evidence,
      changedFiles: ['control-plane/a.ts', 'control-plane/c.ts'],
      labelTier: 2,
      impliedMode: 'autonomous'
    });

    expect(errors).toEqual([
      'Affected paths mismatch: governance/evidence.json must exactly match changed files. expected=["control-plane/a.ts","control-plane/c.ts"] actual=["control-plane/a.ts","control-plane/b.ts"]',
      'Execution mode mismatch: implied mode is autonomous; governance/evidence.json mode must be autonomous.',
      'Risk tier mismatch: label tier is 2; governance/evidence.json tier must be 2.'
    ]);
  });
});
