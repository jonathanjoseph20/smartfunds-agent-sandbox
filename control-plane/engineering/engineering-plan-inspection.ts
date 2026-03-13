import { createEngineeringPlanManager } from './engineering-plan-manager.ts';
import type { EngineeringPlanProjection } from './engineering-plan-types.ts';

type EngineeringPlanInspectionManager = ReturnType<typeof createEngineeringPlanManager>;

export function createEngineeringPlanInspection(options: {
  manager?: EngineeringPlanInspectionManager;
  plansFilePath?: string;
  historyFilePath?: string;
} = {}) {
  const manager = options.manager ?? createEngineeringPlanManager({
    plansFilePath: options.plansFilePath,
    historyFilePath: options.historyFilePath,
  });

  function listEngineeringPlans(): EngineeringPlanProjection[] {
    return manager.listEngineeringPlanProjections();
  }

  function getEngineeringPlan(planId: string): EngineeringPlanProjection {
    return manager.deriveEngineeringPlanProjection(planId);
  }

  function inspectEngineeringPlan(planId: string): EngineeringPlanProjection {
    return manager.deriveEngineeringPlanProjection(planId);
  }

  return {
    listEngineeringPlans,
    getEngineeringPlan,
    inspectEngineeringPlan,
  };
}

export type EngineeringPlanInspection = ReturnType<typeof createEngineeringPlanInspection>;
