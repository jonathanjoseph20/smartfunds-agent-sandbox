import { describe, expect, it } from 'vitest';

import {
  extractTierFromEvidence,
  extractTierFromLabels,
  inferImpliedTier,
  parseEvidenceBlock,
  validatePrData,
  type PullRequestData,
  type RiskContract
} from './validate-pr';

const contract: RiskContract = {
  tiers: {
    0: { description: 'Docs', required_checks: [] },
    1: { description: 'Low', required_checks: [] },
    2: { description: 'Medium', required_checks: [] },
    3: { description: 'High', required_checks: [] }
  },
  paths: {
    'control-plane/**': 3,
    'packages/shared/**': 3,
    'packages/mission-engine/**': 2,
    'apps/**': 1,
    'docs/**': 0,
    '*.md': 0
  }
};

function pr(overrides: Partial<PullRequestData> = {}): PullRequestData {
  return {
    body: `\`\`\`evidence
Risk Tier: 1
Justification: App-only change
Affected Paths: apps/api/src/index.ts
Tests Added: npm --workspace @smartfunds/api run test
Determinism Statement: Static inputs and deterministic assertions
\`\`\``,
    labels: ['tier-1'],
    changedFiles: ['apps/api/src/index.ts'],
    ...overrides
  };
}

describe('validate-pr governance', () => {
  it('passes when tier label, evidence, and low-tier paths align', () => {
    const result = validatePrData(pr(), contract);
    expect(result.ok).toBe(true);
    expect(result.impliedTier).toBe(1);
  });

  it('fails when no tier label exists', () => {
    const result = validatePrData(pr({ labels: [] }), contract);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('Missing risk tier label');
  });

  it('fails when label is tier-1 but implied tier is tier-3', () => {
    const result = validatePrData(pr({ changedFiles: ['control-plane/validate-pr.ts'] }), contract);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('below implied tier-3');
    expect(result.errors.join('\n')).toContain('control-plane/validate-pr.ts');
  });

  it('fails tier-3 without tier-3-approved label', () => {
    const result = validatePrData(
      pr({
        labels: ['tier-3'],
        body: pr().body.replace('Risk Tier: 1', 'Risk Tier: 3'),
        changedFiles: ['control-plane/risk-contract.json']
      }),
      contract
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('tier-3-approved');
  });

  it('fails when determinism statement is missing', () => {
    const body = `\`\`\`evidence
Risk Tier: 2
Justification: Medium risk
Affected Paths: packages/mission-engine/src/engine.ts
Tests Added: npm --workspace @smartfunds/mission-engine run test
\`\`\``;

    const result = validatePrData(
      pr({ labels: ['tier-2'], body, changedFiles: ['packages/mission-engine/src/engine.ts'] }),
      contract
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('Determinism Statement');
  });

  it('fails when evidence block is malformed', () => {
    const result = validatePrData(pr({ body: 'Risk Tier: 1' }), contract);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('Missing fenced evidence block');
  });

  it('fails when body tier differs from label tier', () => {
    const result = validatePrData(
      pr({ body: pr().body.replace('Risk Tier: 1', 'Risk Tier: 2') }),
      contract
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('labels are authoritative');
  });

  it('passes docs-only change with tier-0', () => {
    const tier0Body = pr().body
      .replace('Risk Tier: 1', 'Risk Tier: 0')
      .replace('Justification: App-only change', 'Justification: Documentation only')
      .replace('Affected Paths: apps/api/src/index.ts', 'Affected Paths: docs/code-factory-governance.md');

    const result = validatePrData(
      pr({
        labels: ['tier-0'],
        body: tier0Body,
        changedFiles: ['docs/code-factory-governance.md']
      }),
      contract
    );

    expect(result.ok).toBe(true);
    expect(result.impliedTier).toBe(0);
  });
});

describe('helpers', () => {
  it('extracts tier from labels', () => {
    expect(extractTierFromLabels(['foo', 'tier-2'])).toBe(2);
  });

  it('extracts tier from evidence', () => {
    expect(extractTierFromEvidence(pr().body)).toBe(1);
    expect(parseEvidenceBlock(pr().body)?.['Justification']).toContain('App-only change');
  });

  it('infers maximum tier from matching globs', () => {
    const inferred = inferImpliedTier(
      ['README.md', 'packages/shared/src/index.ts', 'apps/api/src/index.ts'],
      contract
    );
    expect(inferred.impliedTier).toBe(3);
    expect(inferred.escalationFiles).toContain('packages/shared/src/index.ts');
  });
});
