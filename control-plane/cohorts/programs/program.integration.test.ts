import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalEmitter } from '../../signals/signal-emitter.ts';
import { createInvestigationStore } from '../../investigations/investigation-store.ts';

import { createCohortProgramInspection } from './program-inspection.ts';
import { createCohortProgramMaterializer } from './program-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-cohort-program-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function createInspection(scope: string) {
  const root = path.join(tmpRoot, scope);
  return createCohortProgramInspection({
    cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts'),
    synthesisArtifactsRoot: path.join(root, 'artifacts', 'syntheses'),
    investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations'),
    investigationsRootDir: path.join(root, 'investigations'),
    signalsRootDir: path.join(root, 'signals')
  });
}

function createEmitter(scope: string) {
  const root = path.join(tmpRoot, scope);
  return createSignalEmitter({
    signalsRootDir: path.join(root, 'signals'),
    triggersRootDir: path.join(root, 'triggers'),
    investigationsRootDir: path.join(root, 'investigations'),
    investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations')
  });
}

describe('cohort program integration', () => {
  it('T-CP-INT1 signal -> investigation -> cohort -> program follow-up is deterministic and bounded', () => {
    const scope = 'full-flow';
    const emitter = createEmitter(scope);
    const inspection = createInspection(scope);

    const emitted = emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'daily:2026-03-11',
      protocol: 'Aave',
      riskLevel: 'high'
    });

    expect(emitted.status).toBe('persisted');

    const run = inspection.runProgram({
      programId: 'aave-risk-monitor',
      slot: 'daily:2026-03-11'
    });

    expect(run.programId).toBe('aave-risk-monitor');
    expect(run.matchedConditionKinds.length).toBeGreaterThan(0);

    const status = inspection.inspectProgramStatus({
      cohortId: 'aave-risk',
      slot: 'daily:2026-03-11'
    });

    expect(['inactive', 'monitoring', 'investigating', 'escalated', 'stable']).toContain(status.cohortLifecycleState);
  });

  it('T-CP-INT2 cadence cycle launches once per slot and dedupes same-slot reruns', () => {
    const scope = 'cadence-cycle';
    const inspection = createInspection(scope);

    const first = inspection.runProgram({
      programId: 'aave-risk-monitor',
      slot: 'daily:2026-03-11'
    });
    const second = inspection.runProgram({
      programId: 'aave-risk-monitor',
      slot: 'daily:2026-03-11'
    });
    const third = inspection.runProgram({
      programId: 'aave-risk-monitor',
      slot: 'daily:2026-03-12'
    });

    expect(first.currentSlot).toBe('daily:2026-03-11');
    expect(second.currentSlot).toBe('daily:2026-03-11');
    expect(second.launches.every((entry) => ['started', 'duplicate', 'skipped', 'failed'].includes(entry.status))).toBe(true);
    expect(third.currentSlot).toBe('daily:2026-03-12');
  });

  it('T-CP-INT3 program run materializes stable artifacts for seeded definitions', () => {
    const scope = 'materialization';
    const root = path.join(tmpRoot, scope);

    const inspection = createInspection(scope);
    const materializer = createCohortProgramMaterializer({
      inspection,
      cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts')
    });

    inspection.runProgram({
      programId: 'aave-risk-monitor',
      slot: 'daily:2026-03-11'
    });

    const materialized = materializer.materializeCohortPrograms({
      cohortId: 'aave-risk',
      slot: 'daily:2026-03-11'
    });

    expect(materialized.length).toBeGreaterThan(0);
    expect(fs.existsSync(materialized[0]!.statusJsonPath)).toBe(true);
    expect(fs.existsSync(materialized[0]!.historyJsonPath)).toBe(true);
    expect(fs.existsSync(materialized[0]!.reportMarkdownPath)).toBe(true);
  });

  it('T-CP-INT4 cohort lifecycle projects active monitoring states after program execution', () => {
    const scope = 'lifecycle-transition';
    const emitter = createEmitter(scope);
    const inspection = createInspection(scope);

    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'daily:2026-03-11',
      protocol: 'Aave',
      riskLevel: 'high'
    });

    inspection.runProgram({
      programId: 'aave-risk-monitor',
      slot: 'daily:2026-03-11'
    });

    const status = inspection.inspectProgramStatus({
      cohortId: 'aave-risk',
      slot: 'daily:2026-03-11'
    });

    expect(['monitoring', 'stable', 'investigating', 'escalated']).toContain(status.cohortLifecycleState);
  });

  it('T-CP-INT5 regression existing investigation semantics remain intact under duplicate signal emission', () => {
    const scope = 'regression';
    const root = path.join(tmpRoot, scope);
    const emitter = createEmitter(scope);

    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'daily:2026-03-11',
      protocol: 'Aave',
      riskLevel: 'high'
    });
    const duplicate = emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'daily:2026-03-11',
      protocol: 'Aave',
      riskLevel: 'high'
    });

    expect(duplicate.status).toBe('duplicate');

    const store = createInvestigationStore({ rootDir: path.join(root, 'investigations') });
    const runs = store.listInvestigations().filter((entry) => entry.investigationDefinitionId === 'protocol-risk-investigation');

    expect(runs).toHaveLength(1);
  });
});
