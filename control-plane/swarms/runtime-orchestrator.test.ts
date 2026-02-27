import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runRuntimeOrchestratorFromRepo, stableStringify } from './runtime-orchestrator.ts';

type FixtureSwarm = {
  swarmId: string;
  executionMode: 'structured' | 'autonomous';
};

type FixtureOrchestrationSwarm = {
  swarmId: string;
  phase: 'plan' | 'setup' | 'implement' | 'verify' | 'test' | 'release';
  dependsOn: string[];
  allowsCrossModeDeps?: boolean;
};

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-orchestrator-'));
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function setupFixture(params: {
  swarms: FixtureSwarm[];
  orchestrationSwarms: FixtureOrchestrationSwarm[];
}): {
  projectsDir: string;
  swarmsDir: string;
  registryPath: string;
} {
  const root = makeTempDir();
  const projectsDir = path.join(root, 'projects');
  const swarmsDir = path.join(root, 'swarms');
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.mkdirSync(swarmsDir, { recursive: true });

  writeJson(path.join(projectsDir, 'docs.json'), {
    projectId: 'docs',
    ownedPaths: ['docs/**']
  });

  for (const swarm of params.swarms) {
    writeJson(path.join(swarmsDir, `${swarm.swarmId}.json`), {
      swarmId: swarm.swarmId,
      project: 'docs',
      team: 'docs',
      executionMode: swarm.executionMode
    });
  }

  const registryPath = path.join(root, 'orchestration.json');
  writeJson(registryPath, {
    version: 1,
    swarms: params.orchestrationSwarms
  });

  return {
    projectsDir,
    swarmsDir,
    registryPath
  };
}

describe('runtime orchestrator', () => {
  it('returns deterministic no-op success for empty orchestration', () => {
    const fixture = setupFixture({
      swarms: [],
      orchestrationSwarms: []
    });

    const report = runRuntimeOrchestratorFromRepo(fixture);

    expect(report).toEqual({
      orchestrationVersion: 1,
      validationStatus: 'ok',
      validationViolations: [],
      executionAttempted: true,
      executionOrder: [],
      executionResults: []
    });
  });

  it('produces stable chain execution order and full deterministic report', () => {
    const fixture = setupFixture({
      swarms: [
        { swarmId: 'swarm-a', executionMode: 'structured' },
        { swarmId: 'swarm-b', executionMode: 'structured' },
        { swarmId: 'swarm-c', executionMode: 'structured' }
      ],
      orchestrationSwarms: [
        { swarmId: 'swarm-c', phase: 'verify', dependsOn: ['swarm-b'] },
        { swarmId: 'swarm-a', phase: 'setup', dependsOn: [] },
        { swarmId: 'swarm-b', phase: 'implement', dependsOn: ['swarm-a'] }
      ]
    });

    const report = runRuntimeOrchestratorFromRepo(fixture);

    expect(report).toEqual({
      orchestrationVersion: 1,
      validationStatus: 'ok',
      validationViolations: [],
      executionAttempted: true,
      executionOrder: ['swarm-a', 'swarm-b', 'swarm-c'],
      executionResults: [
        { swarmId: 'swarm-a', phase: 'setup', executionStatus: 'success' },
        { swarmId: 'swarm-b', phase: 'implement', executionStatus: 'success' },
        { swarmId: 'swarm-c', phase: 'verify', executionStatus: 'success' }
      ]
    });

    expect(stableStringify(report)).toMatchInlineSnapshot(
      `"{\"executionAttempted\":true,\"executionOrder\":[\"swarm-a\",\"swarm-b\",\"swarm-c\"],\"executionResults\":[{\"executionStatus\":\"success\",\"phase\":\"setup\",\"swarmId\":\"swarm-a\"},{\"executionStatus\":\"success\",\"phase\":\"implement\",\"swarmId\":\"swarm-b\"},{\"executionStatus\":\"success\",\"phase\":\"verify\",\"swarmId\":\"swarm-c\"}],\"orchestrationVersion\":1,\"validationStatus\":\"ok\",\"validationViolations\":[]}"`
    );
  });

  it('locks deterministic order for diamond graph', () => {
    const fixture = setupFixture({
      swarms: [
        { swarmId: 'swarm-a', executionMode: 'structured' },
        { swarmId: 'swarm-b', executionMode: 'structured' },
        { swarmId: 'swarm-c', executionMode: 'structured' },
        { swarmId: 'swarm-d', executionMode: 'structured' }
      ],
      orchestrationSwarms: [
        { swarmId: 'swarm-d', phase: 'test', dependsOn: ['swarm-c', 'swarm-b'] },
        { swarmId: 'swarm-b', phase: 'implement', dependsOn: ['swarm-a'] },
        { swarmId: 'swarm-a', phase: 'setup', dependsOn: [] },
        { swarmId: 'swarm-c', phase: 'implement', dependsOn: ['swarm-a'] }
      ]
    });

    const report = runRuntimeOrchestratorFromRepo(fixture);

    expect(report.validationStatus).toBe('ok');
    expect(report.executionOrder).toEqual(['swarm-a', 'swarm-b', 'swarm-c', 'swarm-d']);
  });

  it('uses lexicographic tie-break for independent nodes', () => {
    const fixture = setupFixture({
      swarms: [
        { swarmId: 'swarm-b', executionMode: 'structured' },
        { swarmId: 'swarm-a', executionMode: 'structured' },
        { swarmId: 'swarm-c', executionMode: 'structured' }
      ],
      orchestrationSwarms: [
        { swarmId: 'swarm-c', phase: 'setup', dependsOn: [] },
        { swarmId: 'swarm-b', phase: 'setup', dependsOn: [] },
        { swarmId: 'swarm-a', phase: 'setup', dependsOn: [] }
      ]
    });

    const report = runRuntimeOrchestratorFromRepo(fixture);

    expect(report.validationStatus).toBe('ok');
    expect(report.executionOrder).toEqual(['swarm-a', 'swarm-b', 'swarm-c']);
  });

  it('returns canonical cycle and does not attempt execution', () => {
    const fixture = setupFixture({
      swarms: [
        { swarmId: 'swarm-a', executionMode: 'structured' },
        { swarmId: 'swarm-b', executionMode: 'structured' }
      ],
      orchestrationSwarms: [
        { swarmId: 'swarm-b', phase: 'implement', dependsOn: ['swarm-a'] },
        { swarmId: 'swarm-a', phase: 'setup', dependsOn: ['swarm-b'] }
      ]
    });

    const report = runRuntimeOrchestratorFromRepo(fixture);

    expect(report).toEqual({
      orchestrationVersion: 1,
      validationStatus: 'failed',
      validationViolations: ['orchestration.cycle_detected: cycle=swarm-a->swarm-b'],
      cycleDetected: ['swarm-a', 'swarm-b'],
      executionAttempted: false,
      executionOrder: [],
      executionResults: []
    });
  });

  it('fails on phase-order violation and does not execute', () => {
    const fixture = setupFixture({
      swarms: [
        { swarmId: 'swarm-setup', executionMode: 'structured' },
        { swarmId: 'swarm-impl', executionMode: 'structured' }
      ],
      orchestrationSwarms: [
        { swarmId: 'swarm-setup', phase: 'setup', dependsOn: ['swarm-impl'] },
        { swarmId: 'swarm-impl', phase: 'implement', dependsOn: [] }
      ]
    });

    const report = runRuntimeOrchestratorFromRepo(fixture);

    expect(report.validationStatus).toBe('failed');
    expect(report.validationViolations).toEqual([
      'orchestration.phase_order_violation: dependency=swarm-impl phase=implement dependent=swarm-setup phase=setup'
    ]);
    expect(report.executionAttempted).toBe(false);
    expect(report.executionOrder).toEqual([]);
    expect(report.executionResults).toEqual([]);
  });

  it('fails on cross-mode violation, preserves contract strings, and sorts violations lexicographically', () => {
    const fixture = setupFixture({
      swarms: [
        { swarmId: 'swarm-a', executionMode: 'autonomous' },
        { swarmId: 'swarm-b', executionMode: 'structured' }
      ],
      orchestrationSwarms: [
        { swarmId: 'swarm-b', phase: 'setup', dependsOn: ['swarm-a'] },
        { swarmId: 'swarm-a', phase: 'implement', dependsOn: [] }
      ]
    });

    const report = runRuntimeOrchestratorFromRepo(fixture);

    expect(report.validationStatus).toBe('failed');
    expect(report.validationViolations).toEqual([
      'orchestration.cross_mode_dependency_denied: from=swarm-a(autonomous) to=swarm-b(structured)',
      'orchestration.phase_order_violation: dependency=swarm-a phase=implement dependent=swarm-b phase=setup'
    ]);
    expect(report.executionAttempted).toBe(false);
  });
});
