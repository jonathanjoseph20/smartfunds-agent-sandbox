import { describe, expect, it } from 'vitest';

import { deriveProductSpecStatus } from '../../products/product-spec-status.ts';

describe('product spec status derivation', () => {
  it('T-PF1-S1 maps incomplete validation to incomplete status', () => {
    expect(deriveProductSpecStatus({
      validationState: 'incomplete',
      missingFields: ['name'],
      constraintViolations: [],
      warnings: [],
    })).toBe('incomplete');
  });

  it('T-PF1-S2 maps invalid validation to blocked status', () => {
    expect(deriveProductSpecStatus({
      validationState: 'invalid',
      missingFields: [],
      constraintViolations: ['originMissionIds_contains_duplicates'],
      warnings: [],
    })).toBe('blocked');
  });

  it('T-PF1-S3 maps valid validation to draft unless explicitly promoted', () => {
    const validation = {
      validationState: 'valid' as const,
      missingFields: [],
      constraintViolations: [],
      warnings: [],
    };

    expect(deriveProductSpecStatus(validation)).toBe('draft');
    expect(deriveProductSpecStatus(validation, { promotedToValidated: true })).toBe('validated');
  });
});
