import type { ProductSpecStatus, ProductSpecValidation } from './product-spec-types.ts';

export function deriveProductSpecStatus(
  validation: ProductSpecValidation,
  options: { promotedToValidated?: boolean } = {},
): ProductSpecStatus {
  if (validation.missingFields.length > 0 || validation.validationState === 'incomplete') {
    return 'incomplete';
  }

  if (validation.constraintViolations.length > 0 || validation.validationState === 'invalid') {
    return 'blocked';
  }

  if (options.promotedToValidated) {
    return 'validated';
  }

  return 'draft';
}
