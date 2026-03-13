import { describe, expect, it } from 'vitest';

import { EngineeringPlanStatus } from '../../engineering/engineering-plan-status.ts';
import { projectEngineeringPlan } from '../../engineering/engineering-plan-projection.ts';

describe('engineering plan projection', () => {
  it('T-PF2-P1 projects deterministic authoritative surface', () => {
    const projection = projectEngineeringPlan({
      plan: {
        planId: 'plan-1',
        specId: 'spec-1',
        architectureSummary: 'Architecture One',
        subsystems: ['worker', 'api'],
        implementationPhases: ['phase-2', 'phase-1'],
        dependencies: ['queue', 'db'],
        integrationRequirements: ['billing', 'auth'],
        testStrategy: 'Unit and integration tests',
        constraints: ['deterministic'],
        status: EngineeringPlanStatus.DRAFT,
      },
      validation: {
        validationState: 'valid',
        missingFields: [],
        constraintViolations: [],
        warnings: ['constraints_recommended', 'dependencies_recommended'],
      },
      historyEvents: [
        {
          eventType: 'engineering_plan_created',
          planId: 'plan-1',
          payloadHash: 'hash-1',
        },
      ],
    });

    expect(projection).toEqual({
      planId: 'plan-1',
      specId: 'spec-1',
      status: EngineeringPlanStatus.DRAFT,
      validationState: 'valid',
      missingFields: [],
      warnings: ['constraints_recommended', 'dependencies_recommended'],
      subsystems: ['api', 'worker'],
      implementationPhases: ['phase-1', 'phase-2'],
      dependencies: ['db', 'queue'],
      integrationRequirements: ['auth', 'billing'],
    });
  });
});
