import { describe, expect, it } from 'vitest';

import { deriveEngineeringPlanStatus, EngineeringPlanStatus } from '../../engineering/engineering-plan-status.ts';

describe('engineering plan status derivation', () => {
  it('T-PF2-S1 maps incomplete validation to incomplete status', () => {
    expect(deriveEngineeringPlanStatus({
      validationState: 'incomplete',
      missingFields: ['specId'],
      constraintViolations: [],
      warnings: [],
    })).toBe(EngineeringPlanStatus.INCOMPLETE);
  });

  it('T-PF2-S2 maps invalid validation to blocked status', () => {
    expect(deriveEngineeringPlanStatus({
      validationState: 'invalid',
      missingFields: [],
      constraintViolations: ['subsystems_contains_duplicates'],
      warnings: [],
    })).toBe(EngineeringPlanStatus.BLOCKED);
  });

  it('T-PF2-S3 maps valid validation to draft unless explicitly promoted', () => {
    const validation = {
      validationState: 'valid' as const,
      missingFields: [],
      constraintViolations: [],
      warnings: [],
    };

    expect(deriveEngineeringPlanStatus(validation)).toBe(EngineeringPlanStatus.DRAFT);
    expect(deriveEngineeringPlanStatus(validation, { promotedToValidated: true })).toBe(EngineeringPlanStatus.VALIDATED);
  });
});
