import { describe, expect, it } from 'vitest';

import {
  projectCodexExecutionPacket,
  projectCodexExecutionPackets,
} from '../../codex/codex-execution-packet-projection.ts';

describe('codex execution packet projection', () => {
  it('T-PF4-P1 projection composes packet+validation+history and computes deterministic counts', () => {
    const packet = {
      packetId: 'packet-1',
      graphId: 'graph-1',
      taskId: 'task-1',
      taskName: 'Task',
      taskDescription: 'Desc',
      subsystem: 'api',
      phase: 'phase-1',
      dependencies: ['task-0', 'task-2'],
      promptTemplate: 'Prompt',
      expectedArtifacts: ['a.ts', 'b.ts'],
      validationRules: ['rule-a'],
      status: 'validated' as const,
    };

    const projection = projectCodexExecutionPacket({
      packet,
      validation: {
        validationState: 'valid',
        missingFields: [],
        constraintViolations: [],
        warnings: [],
      },
      history: [
        {
          packetId: 'packet-1',
          eventType: 'codex_execution_packet_created',
          payloadHash: 'aaa',
          payload: {},
        },
      ],
    });

    expect(projection).toEqual({
      packetId: 'packet-1',
      graphId: 'graph-1',
      taskId: 'task-1',
      status: 'validated',
      validationState: 'valid',
      dependencyCount: 2,
      artifactCount: 2,
      phase: 'phase-1',
      subsystem: 'api',
    });
  });

  it('T-PF4-P2 list projection ordering is stable and read-model only', () => {
    const packets = [
      {
        packetId: 'packet-b',
        graphId: 'graph-1',
        taskId: 'task-b',
        taskName: 'Task B',
        taskDescription: 'Desc',
        subsystem: 'api',
        phase: 'phase-b',
        dependencies: [],
        promptTemplate: 'Prompt',
        expectedArtifacts: ['b.ts'],
        validationRules: ['rule'],
        status: 'ready' as const,
      },
      {
        packetId: 'packet-a',
        graphId: 'graph-1',
        taskId: 'task-a',
        taskName: 'Task A',
        taskDescription: 'Desc',
        subsystem: 'api',
        phase: 'phase-a',
        dependencies: ['task-x'],
        promptTemplate: 'Prompt',
        expectedArtifacts: ['a.ts'],
        validationRules: ['rule'],
        status: 'validated' as const,
      },
    ];

    const projected = projectCodexExecutionPackets({
      packets,
      getValidation: () => ({
        validationState: 'valid',
        missingFields: [],
        constraintViolations: [],
        warnings: [],
      }),
      getHistory: () => [],
    });

    expect(projected.map((entry) => entry.packetId)).toEqual(['packet-a', 'packet-b']);
    expect((packets[0] as { packetId: string }).packetId).toBe('packet-b');
  });
});
