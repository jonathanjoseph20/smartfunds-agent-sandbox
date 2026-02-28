import { describe, expect, it } from 'vitest';

import { classifyIsolation } from './path-classifier.ts';

describe('classifyIsolation', () => {
  it('passes for swarm branch touching autonomous-only docs paths', () => {
    const output = classifyIsolation({
      branchName: 'swarm/task-1',
      changedFiles: ['docs/readme.md']
    });

    expect(output.autonomousContextDetected).toBe(true);
    expect(output.branchNamespaceValid).toBe(true);
    expect(output.isolationStatus).toBe('ok');
    expect(output.isolationViolations).toEqual([]);
    expect(output.structuredPathsTouched).toEqual([]);
    expect(output.autonomousPathsTouched).toEqual(['docs/readme.md']);
  });

  it('fails for swarm branch touching governance core', () => {
    const output = classifyIsolation({
      branchName: 'swarm/task-2',
      changedFiles: ['control-plane/governance/diagnostics.ts']
    });

    expect(output.autonomousContextDetected).toBe(true);
    expect(output.isolationStatus).toBe('autonomous_governance_core_mutation');
    expect(output.isolationViolations).toEqual([
      'governance_core_mutation_attempt',
      'structured_path_in_autonomous_context'
    ]);
  });

  it('fails for invalid swarm branch namespace', () => {
    const output = classifyIsolation({
      branchName: 'swarm/Bad Namespace',
      changedFiles: ['docs/readme.md']
    });

    expect(output.autonomousContextDetected).toBe(true);
    expect(output.branchNamespaceValid).toBe(false);
    expect(output.isolationStatus).toBe('invalid_autonomous_branch_namespace');
    expect(output.isolationViolations).toEqual(['invalid_branch_namespace']);
  });

  it('is deterministic by sorting and deduping paths', () => {
    const output = classifyIsolation({
      branchName: 'swarm/task-3',
      changedFiles: ['docs/b.md', 'docs/a.md', 'docs/a.md']
    });

    expect(output.autonomousPathsTouched).toEqual(['docs/a.md', 'docs/b.md']);
  });

  it('does not trigger autonomous context on non-swarm branch by name only', () => {
    const output = classifyIsolation({
      branchName: 'feature/x',
      changedFiles: ['control-plane/finance/determinism.ts']
    });

    expect(output.autonomousContextDetected).toBe(false);
    expect(output.isolationStatus).toBe('ok');
    expect(output.isolationViolations).toEqual([]);
  });

  it('matches rail registry by exact canonical path', () => {
    const output = classifyIsolation({
      branchName: 'swarm/task-4',
      changedFiles: ['control-plane/entities/rails.json']
    });

    expect(output.isolationStatus).toBe('autonomous_rail_registry_mutation');
    expect(output.isolationViolations).toEqual([
      'rail_registry_mutation_attempt',
      'structured_path_in_autonomous_context'
    ]);
  });
});
