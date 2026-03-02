import { describe, expect, it } from 'vitest';

import {
  extractTierFromLabels,
  inferImpliedTier,
  type RiskContract
} from './governance/diagnostics.ts';

const contract: RiskContract = {
  tiers: {
    0: { description: 'Docs', required_checks: ['lint_tier0'] },
    1: { description: 'Low', required_checks: ['lint_tier0', 'unit_tests'] },
    2: {
      description: 'Medium',
      required_checks: ['lint_tier0', 'unit_tests', 'integration_tests', 'schema_checks']
    },
    3: {
      description: 'High',
      required_checks: ['lint_tier0', 'unit_tests', 'integration_tests', 'schema_checks', 'tier3_label_gate']
    }
  },
  paths: {
    'control-plane/**': 3,
    'packages/shared/**': 3,
    'packages/mission-engine/**': 2,
    'packages/doc-factory/**': 2,
    'packages/compliance/**': 2,
    'packages/exports/**': 2,
    'apps/**': 1,
    'docs/**': 0,
    '*.md': 0
  },
  default_tier: 1
};

describe('validate-pr governance helpers', () => {
  it('extracts tier from labels', () => {
    expect(extractTierFromLabels(['foo', 'tier-2'])).toBe(2);
  });

  it('infers maximum tier from matching globs', () => {
    const inferred = inferImpliedTier(
      ['README.md', 'packages/shared/src/index.ts', 'apps/api/src/index.ts'],
      contract
    );
    expect(inferred.impliedTier).toBe(3);
    expect(inferred.escalationFiles).toContain('packages/shared/src/index.ts');
  });

  it('uses default tier when no path mapping matches', () => {
    const inferred = inferImpliedTier(['scripts/local-dev.sh'], contract);
    expect(inferred.impliedTier).toBe(1);
  });
});
