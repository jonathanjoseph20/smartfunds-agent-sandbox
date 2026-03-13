import { describe, expect, it } from 'vitest';

import { deriveEngineeringPlanId } from '../../engineering/engineering-plan-identity.ts';

describe('engineering plan identity', () => {
  it('T-PF2-ID1 derives deterministic planId from canonical identity payload', () => {
    const first = deriveEngineeringPlanId({
      specId: 'spec-1',
      architectureSummary: 'Service + worker + queue.',
      subsystems: ['api', 'worker'],
      implementationPhases: ['phase-1', 'phase-2'],
      dependencies: ['db', 'queue'],
      integrationRequirements: ['auth-provider', 'billing-provider'],
      testStrategy: 'Unit and integration tests',
      constraints: ['deterministic', 'no-randomness'],
    });

    const second = deriveEngineeringPlanId({
      specId: 'spec-1',
      architectureSummary: 'Service + worker + queue.',
      subsystems: ['worker', 'api'],
      implementationPhases: ['phase-2', 'phase-1'],
      dependencies: ['queue', 'db'],
      integrationRequirements: ['billing-provider', 'auth-provider'],
      testStrategy: 'Unit and integration tests',
      constraints: ['no-randomness', 'deterministic'],
    });

    expect(first).toBe(second);
  });

  it('T-PF2-ID2 excludes non-identity metadata from planId derivation', () => {
    const payload = {
      specId: 'spec-a',
      architectureSummary: 'Architecture A',
      subsystems: ['core'],
      implementationPhases: ['phase-1'],
      dependencies: ['dep-1'],
      integrationRequirements: ['integration-1'],
      testStrategy: 'Strategy A',
      constraints: ['constraint-1'],
      planId: 'noise-plan-id',
      status: 'validated',
      timestamp: '2026-03-13T00:00:00.000Z',
      artifactPath: 'artifacts/engineering/x',
    } as unknown as Parameters<typeof deriveEngineeringPlanId>[0];

    const withNoise = deriveEngineeringPlanId(payload);

    const withoutNoise = deriveEngineeringPlanId({
      specId: 'spec-a',
      architectureSummary: 'Architecture A',
      subsystems: ['core'],
      implementationPhases: ['phase-1'],
      dependencies: ['dep-1'],
      integrationRequirements: ['integration-1'],
      testStrategy: 'Strategy A',
      constraints: ['constraint-1'],
    });

    expect(withNoise).toBe(withoutNoise);
  });
});
