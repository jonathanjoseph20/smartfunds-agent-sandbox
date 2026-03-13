import { describe, expect, it } from 'vitest';

import { validateProductSpec } from '../../products/product-spec-validation.ts';

describe('product spec validation', () => {
  it('T-PF1-V1 detects missing required fields as incomplete', () => {
    const result = validateProductSpec({
      name: 'Spec A',
      problem: '',
      targetUser: '',
      solution: 'Solution A',
      mvpScope: '',
      originMissionIds: [],
    });

    expect(result.validationState).toBe('incomplete');
    expect(result.missingFields).toEqual(['mvpScope', 'originMissionIds', 'problem', 'targetUser']);
  });

  it('T-PF1-V2 flags constraint violations as invalid', () => {
    const result = validateProductSpec({
      name: 'Spec A',
      problem: 'Problem A',
      targetUser: 'User A',
      solution: 'Solution A',
      mvpScope: 'MVP A',
      constraints: [''],
      dependencies: ['dep-a'],
      originMissionIds: ['mission-a', 'mission-a'],
    });

    expect(result.validationState).toBe('invalid');
    expect(result.constraintViolations).toEqual([
      'constraints_contains_empty_value',
      'originMissionIds_contains_duplicates',
    ]);
  });

  it('T-PF1-V3 returns valid for complete spec payload', () => {
    const result = validateProductSpec({
      name: 'Spec A',
      problem: 'Problem A',
      targetUser: 'User A',
      solution: 'Solution A',
      architectureSummary: 'Arch A',
      mvpScope: 'MVP A',
      constraints: ['constraint-a'],
      dependencies: ['dependency-a'],
      originMissionIds: ['mission-a'],
    });

    expect(result.validationState).toBe('valid');
    expect(result.missingFields).toEqual([]);
    expect(result.constraintViolations).toEqual([]);
  });
});
