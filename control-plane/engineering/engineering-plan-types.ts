import type { EngineeringPlanStatus } from './engineering-plan-status.ts';

export type EngineeringPlanValidation = {
  validationState: 'valid' | 'invalid' | 'incomplete';
  missingFields: string[];
  constraintViolations: string[];
  warnings: string[];
};

export type EngineeringPlanHistoryEvent = {
  eventType:
    | 'engineering_plan_created'
    | 'engineering_plan_updated'
    | 'engineering_plan_validated'
    | 'engineering_plan_status_changed';
  planId: string;
  payloadHash: string;
};

export type EngineeringPlan = {
  planId: string;
  specId: string;
  architectureSummary: string;
  subsystems: string[];
  implementationPhases: string[];
  dependencies: string[];
  integrationRequirements: string[];
  testStrategy: string;
  constraints: string[];
  status: EngineeringPlanStatus;
};

export type EngineeringPlanProjection = {
  planId: string;
  specId: string;
  status: EngineeringPlanStatus;
  validationState: string;
  missingFields: string[];
  warnings: string[];
  subsystems: string[];
  implementationPhases: string[];
  dependencies: string[];
  integrationRequirements: string[];
};
