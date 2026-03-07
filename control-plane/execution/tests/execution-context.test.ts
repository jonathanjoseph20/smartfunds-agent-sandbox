import { describe, expect, it } from 'vitest';

import { serializeExecutionContext } from '../context-serializer.ts';
import {
  cloneExecutionContext,
  createEmptyExecutionContext,
  createExecutionContext,
  toReadonlyExecutionContext,
  withExecutionIdentity
} from '../execution-context.ts';

describe('execution context', () => {
  it('creates deterministic empty context', () => {
    const first = createEmptyExecutionContext('run_control-plane_0001');
    const second = createEmptyExecutionContext('run_control-plane_0001');

    expect(first).toEqual(second);
    expect(serializeExecutionContext(first)).toBe(serializeExecutionContext(second));
    expect(first).toEqual({
      runId: 'run_control-plane_0001',
      phase: 'plan',
      taskId: '__run_start__',
      memory: {},
      artifacts: [],
      metadata: {}
    });
  });

  it('normalizes ordering for memory, metadata, and artifacts', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'setup',
      taskId: 'load-run-context',
      memory: {
        z: 2,
        a: 1
      },
      artifacts: ['z.md', 'a.md'],
      metadata: {
        z: true,
        a: false
      }
    });

    expect(Object.keys(context.memory)).toEqual(['a', 'z']);
    expect(context.artifacts).toEqual(['a.md', 'z.md']);
    expect(Object.keys(context.metadata)).toEqual(['a', 'z']);
  });

  it('clone isolates references', () => {
    const original = createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'setup',
      taskId: 'load-run-context',
      memory: { nested: { value: 1 } },
      artifacts: ['a.md'],
      metadata: { nested: { ok: true } }
    });

    const cloned = cloneExecutionContext(original);
    (cloned.memory.nested as { value: number }).value = 99;
    (cloned.metadata.nested as { ok: boolean }).ok = false;
    cloned.artifacts.push('b.md');

    expect(original.memory).toEqual({ nested: { value: 1 } });
    expect(original.metadata).toEqual({ nested: { ok: true } });
    expect(original.artifacts).toEqual(['a.md']);
  });

  it('serializes stably across repeated calls', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'implement',
      taskId: 'execute-work-unit',
      memory: {
        b: { y: 2, x: 1 },
        a: [2, 1]
      },
      metadata: {
        c: 'x',
        a: 'y'
      }
    });

    const first = serializeExecutionContext(context);
    const second = serializeExecutionContext(context);

    expect(first).toBe(second);
  });

  it('updates phase and task identity deterministically', () => {
    const base = createEmptyExecutionContext('run_control-plane_0001');
    const updated = withExecutionIdentity(base, {
      phase: 'verify',
      taskId: 'verify-phase-output'
    });

    expect(updated.phase).toBe('verify');
    expect(updated.taskId).toBe('verify-phase-output');
    expect(updated.memory).toEqual(base.memory);
    expect(updated.artifacts).toEqual(base.artifacts);
  });

  it('provides readonly execution context snapshot', () => {
    const readonlyContext = toReadonlyExecutionContext(createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'setup',
      taskId: 'load-run-context',
      memory: { nested: { count: 1 } }
    }));

    expect(() => {
      (readonlyContext.memory as Record<string, unknown>).newKey = 'x';
    }).toThrow();

    expect(() => {
      ((readonlyContext.memory.nested as { count: number }).count) = 2;
    }).toThrow();
  });

  it('supports additive agent metadata without changing base deterministic behavior', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      missionId: 'rwa-market-analysis',
      teamId: 'smartfunds-research-team',
      phase: 'implement',
      taskId: 'agent-task',
      activeAgent: 'macro-signal-analyst',
      agentEnvelope: {
        agentId: 'macro-signal-analyst',
        role: 'macro-analyst',
        personality: {
          tone: 'analytical',
          reasoningStyle: 'evidence-first'
        },
        skills: ['macro analysis'],
        background: {},
        outputStyle: {},
        constraints: {},
        allowedTools: ['llm', 'repo']
      },
      agentRoster: [
        {
          agentId: 'macro-signal-analyst',
          personality: {},
          skills: [],
          background: {},
          outputStyle: {},
          constraints: {},
          allowedTools: ['llm']
        },
        {
          agentId: 'lead-thesis-architect',
          personality: {},
          skills: [],
          background: {},
          outputStyle: {},
          constraints: {},
          allowedTools: ['llm']
        }
      ]
    });

    expect(context.teamId).toBe('smartfunds-research-team');
    expect(context.activeAgent).toBe('macro-signal-analyst');
    expect(context.agentRoster?.map((entry) => entry.agentId)).toEqual([
      'lead-thesis-architect',
      'macro-signal-analyst'
    ]);
  });
});
