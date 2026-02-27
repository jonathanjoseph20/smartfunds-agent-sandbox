import { describe, expect, it } from 'vitest';

import { buildOrchestrationGraph } from './orchestration-graph.ts';
import { parseOrchestrationRegistryV1 } from './orchestration-schema.ts';
import { evaluateSwarmOrchestration } from './orchestration.ts';
import type { SwarmDefinition } from './types.ts';

function makeRegistry(swarms: Array<{ swarmId: string; phase: 'plan' | 'setup' | 'implement' | 'verify' | 'test' | 'release'; dependsOn: string[]; allowsCrossModeDeps?: boolean }>) {
  return {
    version: 1 as const,
    swarms
  };
}

describe('swarm orchestration schema', () => {
  it('fails when version is missing', () => {
    const parsed = parseOrchestrationRegistryV1({ swarms: [] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toContain('orchestration.schema_invalid: version must be 1');
    }
  });

  it('fails when version is not 1', () => {
    const parsed = parseOrchestrationRegistryV1({ version: 2, swarms: [] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toContain('orchestration.schema_invalid: version must be 1');
    }
  });

  it('fails on duplicate swarm entries', () => {
    const parsed = parseOrchestrationRegistryV1(
      makeRegistry([
        { swarmId: 'swarm-a', phase: 'setup', dependsOn: [] },
        { swarmId: 'swarm-a', phase: 'implement', dependsOn: [] }
      ])
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toContain('orchestration.schema_invalid: duplicate swarmId=swarm-a');
    }
  });
});

describe('swarm orchestration graph', () => {
  it('fails unknown swarmId vs base swarm registry', () => {
    const parsed = parseOrchestrationRegistryV1(makeRegistry([{ swarmId: 'swarm-x', phase: 'setup', dependsOn: [] }]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const graph = buildOrchestrationGraph(parsed.value, ['swarm-a']);
    expect(graph.graphViolations).toContain('orchestration.unknown_swarm: swarmId=swarm-x');
  });

  it('fails duplicate dependsOn entries', () => {
    const parsed = parseOrchestrationRegistryV1(
      makeRegistry([
        { swarmId: 'swarm-a', phase: 'setup', dependsOn: [] },
        { swarmId: 'swarm-b', phase: 'implement', dependsOn: ['swarm-a', 'swarm-a'] }
      ])
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const graph = buildOrchestrationGraph(parsed.value, ['swarm-a', 'swarm-b']);
    expect(graph.graphViolations).toContain('orchestration.dependsOn_duplicates: swarmId=swarm-b dep=swarm-a');
  });

  it('orders chain A->B->C deterministically', () => {
    const parsed = parseOrchestrationRegistryV1(
      makeRegistry([
        { swarmId: 'swarm-c', phase: 'verify', dependsOn: ['swarm-b'] },
        { swarmId: 'swarm-a', phase: 'setup', dependsOn: [] },
        { swarmId: 'swarm-b', phase: 'implement', dependsOn: ['swarm-a'] }
      ])
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const graph = buildOrchestrationGraph(parsed.value, ['swarm-a', 'swarm-b', 'swarm-c']);
    expect(graph.topologicalOrder).toEqual(['swarm-a', 'swarm-b', 'swarm-c']);
  });

  it('orders independent nodes lexicographically', () => {
    const parsed = parseOrchestrationRegistryV1(
      makeRegistry([
        { swarmId: 'swarm-b', phase: 'setup', dependsOn: [] },
        { swarmId: 'swarm-a', phase: 'setup', dependsOn: [] }
      ])
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const graph = buildOrchestrationGraph(parsed.value, ['swarm-a', 'swarm-b']);
    expect(graph.topologicalOrder).toEqual(['swarm-a', 'swarm-b']);
  });

  it('locks deterministic diamond order', () => {
    const parsed = parseOrchestrationRegistryV1(
      makeRegistry([
        { swarmId: 'swarm-d', phase: 'test', dependsOn: ['swarm-b', 'swarm-c'] },
        { swarmId: 'swarm-b', phase: 'implement', dependsOn: ['swarm-a'] },
        { swarmId: 'swarm-a', phase: 'setup', dependsOn: [] },
        { swarmId: 'swarm-c', phase: 'implement', dependsOn: ['swarm-a'] }
      ])
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const graph = buildOrchestrationGraph(parsed.value, ['swarm-a', 'swarm-b', 'swarm-c', 'swarm-d']);
    expect(graph.topologicalOrder).toMatchInlineSnapshot(`
      [
        "swarm-a",
        "swarm-b",
        "swarm-c",
        "swarm-d",
      ]
    `);
  });

  it('detects cycles with canonical stable output', () => {
    const parsed = parseOrchestrationRegistryV1(
      makeRegistry([
        { swarmId: 'swarm-b', phase: 'implement', dependsOn: ['swarm-a'] },
        { swarmId: 'swarm-a', phase: 'setup', dependsOn: ['swarm-b'] }
      ])
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const graph = buildOrchestrationGraph(parsed.value, ['swarm-a', 'swarm-b']);
    expect(graph.cycleDetected).toMatchInlineSnapshot(`
      [
        "swarm-a",
        "swarm-b",
      ]
    `);
    expect(graph.graphViolations).toContain('orchestration.cycle_detected: cycle=swarm-a->swarm-b');
  });

  it('fails phase ordering when dependency phase is after dependent', () => {
    const parsed = parseOrchestrationRegistryV1(
      makeRegistry([
        { swarmId: 'swarm-setup', phase: 'setup', dependsOn: ['swarm-impl'] },
        { swarmId: 'swarm-impl', phase: 'implement', dependsOn: [] }
      ])
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const graph = buildOrchestrationGraph(parsed.value, ['swarm-setup', 'swarm-impl']);
    expect(graph.phaseViolations).toContain(
      'orchestration.phase_order_violation: dependency=swarm-impl phase=implement dependent=swarm-setup phase=setup'
    );
  });
});

describe('swarm orchestration evaluation', () => {
  const baseSwarms: SwarmDefinition[] = [
    { swarmId: 'swarm-a', project: 'docs', team: 'docs', executionMode: 'structured' },
    { swarmId: 'swarm-b', project: 'docs', team: 'docs', executionMode: 'structured' }
  ];

  it('does not enforce orchestration when no swarms are touched', () => {
    const result = evaluateSwarmOrchestration({
      swarmsTouched: [],
      swarms: baseSwarms,
      registryPath: 'path/that/does/not/exist.json'
    });

    expect(result).toEqual({
      status: 'ok',
      violations: [],
      edges: [],
      topologicalOrder: [],
      phaseBySwarm: {}
    });
  });

  it('fails with missing_registry when swarms are touched and registry is missing', () => {
    const result = evaluateSwarmOrchestration({
      swarmsTouched: ['swarm-a'],
      swarms: baseSwarms,
      registryPath: 'path/that/does/not/exist.json'
    });

    expect(result.status).toBe('missing_registry');
    expect(result.violations).toEqual(['orchestration.missing_registry: control-plane/swarms/orchestration.json']);
  });
});
