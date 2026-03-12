import { describe, expect, it } from 'vitest';

import {
  deriveTaskGraphId,
  deriveTaskNodeId,
  normalizeTaskGraphStructure,
} from '../../task-graph/task-graph-identity.ts';

describe('task graph identity', () => {
  it('T-MTG-ID1 graph identity is deterministic for equivalent inputs', () => {
    const structure = normalizeTaskGraphStructure({
      nodes: [
        {
          nodeKey: 'a',
          taskType: 'authorized_action',
          taskName: 'A',
          taskDescription: 'd',
          taskInputs: { z: 2, a: 1 },
          taskOutputs: { y: true },
          requiredCapabilities: ['cap-b', 'cap-a'],
        },
        {
          nodeKey: 'b',
          taskType: 'authorized_action',
          taskName: 'B',
          taskDescription: 'd',
          taskInputs: { y: 2, b: 1 },
          taskOutputs: { x: true },
          requiredCapabilities: ['cap-c'],
        },
      ],
      edges: [
        {
          sourceNodeKey: 'a',
          targetNodeKey: 'b',
          dependencyType: 'finish_to_start',
        },
      ],
    });

    const first = deriveTaskGraphId({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      normalizedGraphStructure: structure,
    });

    const second = deriveTaskGraphId({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      normalizedGraphStructure: structure,
    });

    expect(first).toBe(second);
  });

  it('T-MTG-ID2 reordered equivalent graph inputs yield same identity', () => {
    const first = deriveTaskGraphId({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      normalizedGraphStructure: normalizeTaskGraphStructure({
        nodes: [
          {
            nodeKey: 'n2',
            taskType: 'authorized_action',
            taskName: 'B',
            taskDescription: 'd',
            taskInputs: { b: 2, a: 1 },
            taskOutputs: {},
            requiredCapabilities: ['cap-b', 'cap-a'],
          },
          {
            nodeKey: 'n1',
            taskType: 'authorized_action',
            taskName: 'A',
            taskDescription: 'd',
            taskInputs: { x: 1 },
            taskOutputs: {},
            requiredCapabilities: ['cap-c'],
          },
        ],
        edges: [
          {
            sourceNodeKey: 'n1',
            targetNodeKey: 'n2',
            dependencyType: 'finish_to_start',
          },
        ],
      }),
    });

    const second = deriveTaskGraphId({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      normalizedGraphStructure: normalizeTaskGraphStructure({
        nodes: [
          {
            nodeKey: 'n1',
            taskType: 'authorized_action',
            taskName: 'A',
            taskDescription: 'd',
            taskInputs: { x: 1 },
            taskOutputs: {},
            requiredCapabilities: ['cap-c'],
          },
          {
            nodeKey: 'n2',
            taskType: 'authorized_action',
            taskName: 'B',
            taskDescription: 'd',
            taskInputs: { a: 1, b: 2 },
            taskOutputs: {},
            requiredCapabilities: ['cap-a', 'cap-b'],
          },
        ],
        edges: [
          {
            sourceNodeKey: 'n1',
            targetNodeKey: 'n2',
            dependencyType: 'finish_to_start',
          },
        ],
      }),
    });

    expect(first).toBe(second);
  });

  it('T-MTG-ID3 node identity is deterministic', () => {
    const payload = {
      taskGraphId: 'tg-1',
      taskType: 'authorized_action',
      taskName: 'task-a',
      taskInputs: { b: 2, a: 1 },
    };

    expect(deriveTaskNodeId(payload)).toBe(deriveTaskNodeId(payload));
  });
});
