import { describe, expect, it } from 'vitest';

import { projectProductSpec } from '../../products/product-spec-projection.ts';

describe('product spec projection', () => {
  it('T-PF1-P1 projects deterministic authoritative surface', () => {
    const projection = projectProductSpec({
      spec: {
        specId: 'spec-1',
        name: 'Spec One',
        problem: 'Problem One',
        targetUser: 'User One',
        solution: 'Solution One',
        mvpScope: 'MVP One',
        originMissionIds: ['mission-b', 'mission-a'],
        status: 'draft',
      },
      validation: {
        validationState: 'valid',
        missingFields: [],
        constraintViolations: [],
        warnings: ['constraints_recommended', 'architectureSummary_recommended'],
      },
      historyEvents: [
        {
          eventType: 'product_spec_created',
          specId: 'spec-1',
          payloadHash: 'hash-1',
        },
      ],
    });

    expect(projection).toEqual({
      specId: 'spec-1',
      name: 'Spec One',
      status: 'draft',
      validationState: 'valid',
      missingFields: [],
      warnings: ['architectureSummary_recommended', 'constraints_recommended'],
      originMissionIds: ['mission-a', 'mission-b'],
    });
  });
});
