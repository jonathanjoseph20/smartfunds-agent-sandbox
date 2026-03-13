import type { EngineeringPlanValidation } from './engineering-plan-types.ts';

export const EngineeringPlanStatus = {
  INCOMPLETE: 'incomplete',
  DRAFT: 'draft',
  VALIDATED: 'validated',
  BLOCKED: 'blocked',
  COMPLETE: 'complete',
} as const;

export type EngineeringPlanStatus = (typeof EngineeringPlanStatus)[keyof typeof EngineeringPlanStatus];

export function deriveEngineeringPlanStatus(
  validation: EngineeringPlanValidation,
  options: { promotedToValidated?: boolean } = {},
): EngineeringPlanStatus {
  if (validation.missingFields.length > 0 || validation.validationState === 'incomplete') {
    return EngineeringPlanStatus.INCOMPLETE;
  }

  if (validation.constraintViolations.length > 0 || validation.validationState === 'invalid') {
    return EngineeringPlanStatus.BLOCKED;
  }

  if (options.promotedToValidated) {
    return EngineeringPlanStatus.VALIDATED;
  }

  return EngineeringPlanStatus.DRAFT;
}
