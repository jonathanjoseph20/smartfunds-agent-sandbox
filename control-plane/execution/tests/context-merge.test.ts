import { describe, expect, it } from 'vitest';

import { serializeExecutionContext } from '../context-serializer.ts';
import { applyTaskResultToContext, mergeContextUpdates } from '../context-merge.ts';
import { createExecutionContext } from '../execution-context.ts';

describe('context merge', () => {
  it('overwrites existing keys with shallow replacement semantics', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'setup',
      taskId: 'task-a',
      memory: {
        keep: 'x',
        obj: { left: 1, right: 2 }
      }
    });

    const merged = mergeContextUpdates(context, {
      obj: { right: 9 },
      newKey: 'new-value'
    });

    expect(merged.memory).toEqual({
      keep: 'x',
      newKey: 'new-value',
      obj: { right: 9 }
    });
  });

  it('replaces arrays without deep merge', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'setup',
      taskId: 'task-a',
      memory: {
        arr: [1, 2, 3]
      }
    });

    const merged = mergeContextUpdates(context, {
      arr: ['a']
    });

    expect(merged.memory).toEqual({
      arr: ['a']
    });
  });

  it('allows null values and ignores undefined updates', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'setup',
      taskId: 'task-a',
      memory: {
        keyA: 'value'
      }
    });

    const merged = mergeContextUpdates(context, {
      keyA: undefined,
      keyB: null
    });

    expect(merged.memory).toEqual({
      keyA: 'value',
      keyB: null
    });
  });

  it('keeps serialized output byte-identical for empty updates', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'setup',
      taskId: 'task-a',
      memory: {
        a: 1,
        b: 2
      }
    });

    const before = serializeExecutionContext(context);
    const merged = mergeContextUpdates(context, {});
    const after = serializeExecutionContext(merged);

    expect(after).toBe(before);
  });

  it('applies task result updates and tracks artifact paths deterministically', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'setup',
      taskId: 'task-a',
      memory: {},
      artifacts: ['b.md']
    });

    const merged = applyTaskResultToContext(context, {
      status: 'success',
      outputs: {},
      artifacts: [
        { kind: 'report', path: 'z.md' },
        { kind: 'report', path: 'a.md' }
      ],
      logs: [],
      context_updates: {
        summary: 'ok'
      }
    });

    expect(merged.memory).toEqual({ summary: 'ok' });
    expect(merged.artifacts).toEqual(['a.md', 'b.md', 'z.md']);
  });

  it('produces deterministic serialized output across repeated merges', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'setup',
      taskId: 'task-a',
      memory: { a: 1 }
    });

    const first = mergeContextUpdates(context, { b: 2 });
    const second = mergeContextUpdates(context, { b: 2 });

    expect(serializeExecutionContext(first)).toBe(serializeExecutionContext(second));
  });
});
