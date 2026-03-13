import type {
  EngineeringPlan,
  EngineeringPlanHistoryEvent,
  EngineeringPlanProjection,
  EngineeringPlanValidation,
} from './engineering-plan-types.ts';

type EngineeringPlanProjectionInput = {
  plan: EngineeringPlan;
  validation: EngineeringPlanValidation;
  historyEvents: EngineeringPlanHistoryEvent[];
};

export function projectEngineeringPlan(input: EngineeringPlanProjectionInput): EngineeringPlanProjection {
  return {
    planId: input.plan.planId,
    specId: input.plan.specId,
    status: input.plan.status,
    validationState: input.validation.validationState,
    missingFields: [...input.validation.missingFields].sort((left, right) => left.localeCompare(right)),
    warnings: [...input.validation.warnings].sort((left, right) => left.localeCompare(right)),
    subsystems: [...input.plan.subsystems].sort((left, right) => left.localeCompare(right)),
    implementationPhases: [...input.plan.implementationPhases].sort((left, right) => left.localeCompare(right)),
    dependencies: [...input.plan.dependencies].sort((left, right) => left.localeCompare(right)),
    integrationRequirements: [...input.plan.integrationRequirements].sort((left, right) => left.localeCompare(right)),
  };
}
