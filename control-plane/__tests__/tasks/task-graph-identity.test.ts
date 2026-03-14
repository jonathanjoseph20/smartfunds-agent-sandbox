import { describe, expect, it } from 'vitest';

import {
  deriveImplementationTaskGraphId,
  deriveImplementationTaskNodeId,
  normalizeImplementationTaskGraphStructure,
} from '../../tasks/task-graph-identity.ts';

describe('implementation task graph identity', () => {
  it('T-PF3-ID1 derives deterministic taskGraphId for equivalent structure', () => {
    const structure = normalizeImplementationTaskGraphStructure({
      nodes: [
        {
          phaseKey: 'phase_0001_api',
          taskType: 'implementation_phase',
          taskName: 'Implement api',
          taskDescription: 'x',
          taskInputs: { b: 2, a: 1 },
          requiredCapabilities: ['worker', 'api'],
        },
      ],
      edges: [],
    });

    const first = deriveImplementationTaskGraphId({
      planId: 'plan-1',
      specId: 'spec-1',
      architectureSummary: 'summary',
      testStrategy: 'tests',
      normalizedGraphStructure: structure,
    });

    const second = deriveImplementationTaskGraphId({
      planId: 'plan-1',
      specId: 'spec-1',
      architectureSummary: 'summary',
      testStrategy: 'tests',
      normalizedGraphStructure: structure,
    });

    expect(first).toBe(second);
  });

  it('T-PF3-ID2 derives deterministic taskNodeId', () => {
    const node = {
      taskGraphId: 'tg-1',
      phaseKey: 'phase_0001_api',
      taskType: 'implementation_phase' as const,
      taskInputs: { x: 1, y: 2 },
    };

    expect(deriveImplementationTaskNodeId(node)).toBe(deriveImplementationTaskNodeId(node));
  });
});
