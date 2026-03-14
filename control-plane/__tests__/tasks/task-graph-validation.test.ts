import { describe, expect, it } from 'vitest';

import { validateImplementationTaskGraph } from '../../tasks/task-graph-validation.ts';

describe('implementation task graph validation', () => {
  it('T-PF3-V1 reports invalid edge node references', () => {
    const result = validateImplementationTaskGraph({
      taskGraphId: 'tg-1',
      planId: 'plan-1',
      specId: 'spec-1',
      taskNodes: [{
        taskNodeId: 'n-1',
        taskGraphId: 'tg-1',
        planId: 'plan-1',
        taskType: 'implementation_phase',
        taskName: 'n-1',
        taskDescription: 'n-1',
        taskInputs: {},
        requiredCapabilities: [],
      }],
      taskEdges: [{
        taskEdgeId: 'e-1',
        taskGraphId: 'tg-1',
        sourceNodeId: 'n-1',
        targetNodeId: 'n-missing',
        dependencyType: 'finish_to_start',
      }],
      nodeCount: 1,
      edgeCount: 1,
      limitations: [],
      provenanceInputs: {
        architectureSummary: 'x',
        implementationPhases: ['phase-1'],
        subsystems: [],
        dependencies: [],
        integrationRequirements: [],
        testStrategy: 'tests',
        constraints: [],
      },
    });

    expect(result.validationState).toBe('invalid');
    expect(result.constraintViolations).toContain('edge_node_reference_missing');
  });

  it('T-PF3-V2 validates a simple linear graph', () => {
    const result = validateImplementationTaskGraph({
      taskGraphId: 'tg-1',
      planId: 'plan-1',
      specId: 'spec-1',
      taskNodes: [
        {
          taskNodeId: 'n-1',
          taskGraphId: 'tg-1',
          planId: 'plan-1',
          taskType: 'implementation_phase',
          taskName: 'n-1',
          taskDescription: 'n-1',
          taskInputs: {},
          requiredCapabilities: [],
        },
        {
          taskNodeId: 'n-2',
          taskGraphId: 'tg-1',
          planId: 'plan-1',
          taskType: 'implementation_phase',
          taskName: 'n-2',
          taskDescription: 'n-2',
          taskInputs: {},
          requiredCapabilities: [],
        },
      ],
      taskEdges: [{
        taskEdgeId: 'e-1',
        taskGraphId: 'tg-1',
        sourceNodeId: 'n-1',
        targetNodeId: 'n-2',
        dependencyType: 'finish_to_start',
      }],
      nodeCount: 2,
      edgeCount: 1,
      limitations: [],
      provenanceInputs: {
        architectureSummary: 'x',
        implementationPhases: ['phase-1', 'phase-2'],
        subsystems: [],
        dependencies: [],
        integrationRequirements: [],
        testStrategy: 'tests',
        constraints: [],
      },
    });

    expect(result.validationState).toBe('valid');
    expect(result.constraintViolations).toEqual([]);
  });
});
