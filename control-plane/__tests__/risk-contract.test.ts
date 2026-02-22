import { describe, expect, it } from 'vitest';

import {
  assertValidRiskContract,
  getRequiredChecksForTier,
  inferImpliedTier,
  loadRiskContract,
  type RiskContract
} from '../validate-pr';

describe('risk contract', () => {
  const contract = loadRiskContract(new URL('../risk-contract.json', import.meta.url).pathname);

  it('resolves tier lookup by glob', () => {
    expect(inferImpliedTier(['packages/mission-engine/src/engine.ts'], contract).impliedTier).toBe(2);
    expect(inferImpliedTier(['control-plane/validate-pr.ts'], contract).impliedTier).toBe(3);
    expect(inferImpliedTier(['README.md'], contract).impliedTier).toBe(0);
  });

  it('uses max escalation tier across changed files', () => {
    const result = inferImpliedTier(
      ['apps/api/src/index.ts', 'packages/shared/src/index.ts', 'docs/process.md'],
      contract
    );

    expect(result.impliedTier).toBe(3);
    expect(result.escalationFiles).toContain('packages/shared/src/index.ts');
  });

  it('falls back to default tier for unmapped paths', () => {
    const result = inferImpliedTier(['scripts/dev-helper.sh'], contract);
    expect(result.impliedTier).toBe(contract.default_tier);
    expect(result.impliedTier).toBe(1);
  });

  it('defines required checks for every tier', () => {
    for (const tier of [0, 1, 2, 3] as const) {
      const checks = getRequiredChecksForTier(tier, contract);
      expect(checks.length).toBeGreaterThan(0);
      expect(checks).toContain('lint_tier0');
    }

    expect(getRequiredChecksForTier(3, contract)).toContain('tier3_label_gate');
  });

  it('throws on invalid contract shape', () => {
    const invalid: Partial<RiskContract> = {
      tiers: {
        0: { description: 'Docs', required_checks: ['lint_tier0'] },
        1: { description: 'Low', required_checks: ['lint_tier0'] },
        2: { description: 'Medium', required_checks: ['lint_tier0'] },
        3: { description: 'High', required_checks: ['lint_tier0'] }
      } as RiskContract['tiers'],
      paths: { 'apps/**': 1 }
    };

    expect(() => assertValidRiskContract(invalid)).toThrow(/default_tier/);
  });
});
