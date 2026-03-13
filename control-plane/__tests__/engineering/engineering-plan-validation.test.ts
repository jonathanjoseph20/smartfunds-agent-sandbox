import { describe, expect, it } from 'vitest';

import { validateEngineeringPlan } from '../../engineering/engineering-plan-validation.ts';

describe('engineering plan validation', () => {
  it('T-PF2-V1 detects missing required fields as incomplete', () => {
    const result = validateEngineeringPlan({
      specId: '',
      architectureSummary: '',
      subsystems: [],
      implementationPhases: [],
      testStrategy: '',
    });

    expect(result.validationState).toBe('incomplete');
    expect(result.missingFields).toEqual([
      'architectureSummary',
      'implementationPhases',
      'specId',
      'subsystems',
      'testStrategy',
    ]);
  });

  it('T-PF2-V2 flags constraint violations as invalid', () => {
    const result = validateEngineeringPlan({
      specId: 'spec-1',
      architectureSummary: 'Architecture',
      subsystems: ['core', 'core'],
      implementationPhases: ['phase-1'],
      dependencies: ['dep-a', ''],
      integrationRequirements: ['integration-a', 'integration-a'],
      testStrategy: 'Strategy',
      constraints: ['constraint-a'],
    });

    expect(result.validationState).toBe('invalid');
    expect(result.constraintViolations).toEqual([
      'dependencies_contains_empty_value',
      'integrationRequirements_contains_duplicates',
      'subsystems_contains_duplicates',
    ]);
  });

  it('T-PF2-V3 returns valid for complete payload', () => {
    const result = validateEngineeringPlan({
      specId: 'spec-1',
      architectureSummary: 'Architecture',
      subsystems: ['core'],
      implementationPhases: ['phase-1'],
      dependencies: ['dep-a'],
      integrationRequirements: ['integration-a'],
      testStrategy: 'Strategy',
      constraints: ['constraint-a'],
    });

    expect(result.validationState).toBe('valid');
    expect(result.missingFields).toEqual([]);
    expect(result.constraintViolations).toEqual([]);
  });
});
