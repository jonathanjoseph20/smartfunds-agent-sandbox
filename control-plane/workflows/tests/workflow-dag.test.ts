import { describe, expect, it } from 'vitest';

import { WorkflowDag } from '../workflow-dag.ts';
import { loadWorkflowDefinition } from '../workflow-loader.ts';
import { validateWorkflowDefinition } from '../workflow-validator.ts';

function validWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    workflowId: 'wf-basic',
    nodes: [
      { id: 'a', task: 'task-a' },
      { id: 'b', task: 'task-b', dependsOn: ['a'] },
      { id: 'c', task: 'task-c', dependsOn: ['a'] }
    ],
    ...overrides
  };
}

describe('workflow-dag', () => {
  it('T-WD1 accepts valid DAG and exposes deterministic order', () => {
    const loaded = loadWorkflowDefinition(validWorkflow());
    const dag = new WorkflowDag(loaded);

    expect(dag.getExecutionOrder()).toEqual(['a', 'b', 'c']);
  });

  it('T-WD2 rejects cycle A->B->C->A', () => {
    const result = validateWorkflowDefinition({
      workflowId: 'wf-cycle',
      nodes: [
        { id: 'a', task: 'task-a', dependsOn: ['c'] },
        { id: 'b', task: 'task-b', dependsOn: ['a'] },
        { id: 'c', task: 'task-c', dependsOn: ['b'] }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('workflow.cycle_detected: a->b->c');
  });

  it('T-WD3 rejects duplicate node ids', () => {
    const result = validateWorkflowDefinition({
      workflowId: 'wf-dup',
      nodes: [
        { id: 'a', task: 'task-a' },
        { id: 'a', task: 'task-b' }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('workflow.duplicate_node_id: a');
  });

  it('T-WD4 rejects missing dependency', () => {
    const result = validateWorkflowDefinition({
      workflowId: 'wf-missing-dep',
      nodes: [
        { id: 'a', task: 'task-a', dependsOn: ['unknown'] }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('workflow.missing_dependency: node=a dependsOn=unknown');
  });

  it('T-WD5 rejects self-dependency', () => {
    const result = validateWorkflowDefinition({
      workflowId: 'wf-self',
      nodes: [
        { id: 'a', task: 'task-a', dependsOn: ['a'] }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('workflow.self_dependency: node=a');
  });

  it('T-WD6 enforces deterministic lexicographic tie-break in topological order', () => {
    const loaded = loadWorkflowDefinition({
      workflowId: 'wf-order',
      nodes: [
        { id: 'z', task: 'task-z' },
        { id: 'a', task: 'task-a' },
        { id: 'm', task: 'task-m', dependsOn: ['a'] }
      ]
    });
    const dag = new WorkflowDag(loaded);

    expect(dag.getExecutionOrder()).toEqual(['a', 'm', 'z']);
  });

  it('T-WD7 detects runnable nodes before/after prerequisite completion', () => {
    const loaded = loadWorkflowDefinition(validWorkflow());
    const dag = new WorkflowDag(loaded);

    expect(dag.getRunnableNodeIds([])).toEqual(['a']);
    expect(dag.getRunnableNodeIds(['a'])).toEqual(['b', 'c']);
    expect(dag.getRunnableNodeIds(['a', 'b', 'c'])).toEqual([]);
    expect(dag.isComplete(['a', 'b', 'c'])).toBe(true);
  });
});
