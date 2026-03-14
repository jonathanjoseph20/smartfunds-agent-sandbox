import { describe, expect, it } from 'vitest';

import { projectImplementationTaskGraph } from '../../tasks/task-graph-projection.ts';

describe('implementation task graph projection', () => {
  it('T-PF3-P1 projects deterministic surface and status', () => {
    const projection = projectImplementationTaskGraph({
      graph: {
        taskGraphId: 'tg-1',
        planId: 'plan-1',
        specId: 'spec-1',
        taskNodes: [],
        taskEdges: [],
        nodeCount: 0,
        edgeCount: 0,
        limitations: [],
        provenanceInputs: {
          architectureSummary: 'summary',
          implementationPhases: [],
          subsystems: [],
          dependencies: [],
          integrationRequirements: [],
          testStrategy: 'tests',
          constraints: [],
        },
      },
      planValidation: {
        validationState: 'valid',
        missingFields: [],
        constraintViolations: [],
        warnings: [],
      },
      graphValidation: {
        validationState: 'valid',
        constraintViolations: [],
      },
      historyEvents: [
        {
          eventType: 'implementation_task_graph_created',
          taskGraphId: 'tg-1',
          payloadHash: 'h1',
        },
      ],
    });

    expect(projection.status).toBe('ready');
    expect(projection.historySummary.totalEvents).toBe(1);
    expect(projection.taskGraphId).toBe('tg-1');
  });
});
