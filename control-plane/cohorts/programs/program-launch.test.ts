import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { computeInvestigationDedupeKey, computeInvestigationRunId } from '../../investigations/investigation-deduper.ts';
import { createInvestigationStore } from '../../investigations/investigation-store.ts';
import { createSignalStore } from '../../signals/signal-store.ts';

import { createCohortProgramLaunchEngine } from './program-launch.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-cohort-program-launch');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedProgramDefinition(defsDir: string, value: Record<string, unknown>): void {
  writeJson(path.join(defsDir, `${String(value.programId)}.json`), value);
}

function createEngine(scope: string, defsDir: string) {
  const root = path.join(tmpRoot, scope);
  return createCohortProgramLaunchEngine({
    cohortProgramDefinitionsDir: defsDir,
    cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts'),
    investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations'),
    investigationsRootDir: path.join(root, 'investigations'),
    signalsRootDir: path.join(root, 'signals'),
    now: () => new Date('2026-03-11T12:15:00.000Z')
  });
}

function seedProtocolRiskSignal(root: string, input: { key: string; slot: string; riskLevel: string }): void {
  const signalStore = createSignalStore({ rootDir: path.join(root, 'signals') });
  signalStore.appendSignal({
    signalType: 'protocol_risk',
    sourceMission: 'defi-governance-events',
    dataset: 'protocol_risk_feed',
    metadata: { protocol: 'Aave', riskLevel: input.riskLevel },
    slot: input.slot,
    dedupeKey: input.key,
    logDate: '2026-03-11'
  });
}

function seedPendingProtocolRiskInvestigation(root: string, signalKey: string, slot: string): void {
  const store = createInvestigationStore({ rootDir: path.join(root, 'investigations') });
  const dedupeKey = computeInvestigationDedupeKey({
    investigationDefinitionId: 'protocol-risk-investigation',
    sourceSignalReference: signalKey,
    slot
  });

  store.appendEvent({
    logDate: '2026-03-11',
    event: {
      eventType: 'INVESTIGATION_CREATED',
      investigationRunId: computeInvestigationRunId(dedupeKey),
      dedupeKey,
      investigationDefinitionId: 'protocol-risk-investigation',
      sourceSignalReference: signalKey,
      sourceSignalType: 'protocol_risk',
      sourceTriggerId: 'protocol-risk-investigation',
      sourceTriggerReference: `trigger:protocol-risk-investigation:${signalKey}:${slot}`,
      slot,
      logDate: '2026-03-11',
      associatedMissionReferences: ['defi-governance-events']
    }
  });
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('cohort program launch logic', () => {
  it('T-CP-LAUNCH1 cadence launch is eligible and dedupes per program slot', () => {
    const scope = 'cadence';
    const defsDir = path.join(tmpRoot, scope, 'defs');
    seedProgramDefinition(defsDir, {
      programId: 'aave-risk-monitor',
      cohortId: 'aave-risk',
      displayName: 'Aave Risk Monitor',
      cadence: 'daily',
      enabled: true,
      lifecycleState: 'active',
      investigationTemplates: ['protocol-risk-investigation'],
      launchConditions: [{ kind: 'cadence' }]
    });

    const engine = createEngine(scope, defsDir);
    const first = engine.runProgram({ programId: 'aave-risk-monitor', slot: 'daily:2026-03-11' });
    const second = engine.runProgram({ programId: 'aave-risk-monitor', slot: 'daily:2026-03-11' });

    expect(first.eligibility.eligible).toBe(true);
    expect(first.launches.some((entry) => entry.status === 'started' || entry.status === 'duplicate')).toBe(true);
    expect(second.eligibility.eligible).toBe(false);
    expect(second.launches).toEqual([]);
  });

  it('T-CP-LAUNCH2 signal and degraded-health conditions are eligible deterministically', () => {
    const scope = 'signal-health';
    const root = path.join(tmpRoot, scope);
    const defsDir = path.join(root, 'defs');

    seedProgramDefinition(defsDir, {
      programId: 'aave-risk-monitor',
      cohortId: 'aave-risk',
      displayName: 'Aave Risk Monitor',
      cadence: 'signal_driven',
      enabled: true,
      lifecycleState: 'active',
      investigationTemplates: ['protocol-risk-investigation'],
      launchConditions: [
        { kind: 'signal_type', signalType: 'protocol_risk' },
        { kind: 'cohort_health', health: 'degraded' },
        { kind: 'cohort_health', health: 'conflicted' },
        { kind: 'cohort_health', health: 'unstable' }
      ]
    });

    seedProtocolRiskSignal(root, { key: 'sig-aave-risk-1', slot: 'daily:2026-03-11', riskLevel: 'high' });
    seedPendingProtocolRiskInvestigation(root, 'sig-aave-risk-1', 'daily:2026-03-11');

    const engine = createCohortProgramLaunchEngine({
      cohortProgramDefinitionsDir: defsDir,
      cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts'),
      investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations'),
      investigationsRootDir: path.join(root, 'investigations'),
      signalsRootDir: path.join(root, 'signals'),
      now: () => new Date('2026-03-11T12:15:00.000Z')
    });

    const run = engine.runProgram({ programId: 'aave-risk-monitor', slot: 'daily:2026-03-11' });

    expect(run.eligibility.eligible).toBe(true);
    expect(run.matchedConditionKinds).toContain('signal_type');
  });

  it('T-CP-LAUNCH3 paused/completed/disabled programs never launch', () => {
    const scope = 'gated';
    const defsDir = path.join(tmpRoot, scope, 'defs');

    seedProgramDefinition(defsDir, {
      programId: 'paused-program',
      cohortId: 'aave-risk',
      displayName: 'Paused',
      cadence: 'daily',
      enabled: true,
      lifecycleState: 'paused',
      investigationTemplates: ['protocol-risk-investigation'],
      launchConditions: [{ kind: 'cadence' }]
    });

    seedProgramDefinition(defsDir, {
      programId: 'completed-program',
      cohortId: 'aave-risk',
      displayName: 'Completed',
      cadence: 'daily',
      enabled: true,
      lifecycleState: 'completed',
      investigationTemplates: ['protocol-risk-investigation'],
      launchConditions: [{ kind: 'cadence' }]
    });

    seedProgramDefinition(defsDir, {
      programId: 'disabled-program',
      cohortId: 'aave-risk',
      displayName: 'Disabled',
      cadence: 'daily',
      enabled: false,
      lifecycleState: 'active',
      investigationTemplates: ['protocol-risk-investigation'],
      launchConditions: [{ kind: 'cadence' }]
    });

    const engine = createEngine(scope, defsDir);

    const paused = engine.runProgram({ programId: 'paused-program', slot: 'daily:2026-03-11' });
    const completed = engine.runProgram({ programId: 'completed-program', slot: 'daily:2026-03-11' });
    const disabled = engine.runProgram({ programId: 'disabled-program', slot: 'daily:2026-03-11' });

    expect(paused.eligibility.reason).toBe('not_eligible_lifecycle_state');
    expect(completed.eligibility.reason).toBe('not_eligible_lifecycle_state');
    expect(disabled.eligibility.reason).toBe('not_eligible_lifecycle_state');
    expect(paused.launches).toEqual([]);
    expect(completed.launches).toEqual([]);
    expect(disabled.launches).toEqual([]);
  });

  it('T-CP-LAUNCH4 multiple eligible templates are launched in stable sorted order', () => {
    const scope = 'stable-order';
    const defsDir = path.join(tmpRoot, scope, 'defs');

    seedProgramDefinition(defsDir, {
      programId: 'multi-template',
      cohortId: 'aave-risk',
      displayName: 'Multi Template',
      cadence: 'daily',
      enabled: true,
      lifecycleState: 'active',
      investigationTemplates: ['protocol-risk-investigation', 'governance-proposal-investigation'],
      launchConditions: [{ kind: 'cadence' }]
    });

    const engine = createEngine(scope, defsDir);
    const run = engine.runProgram({ programId: 'multi-template', slot: 'daily:2026-03-11' });

    expect(run.launches.map((entry) => entry.investigationTemplate)).toEqual([
      'governance-proposal-investigation',
      'protocol-risk-investigation'
    ]);
  });

  it('T-CP-LAUNCH5 degraded cohort health condition is eligible without signal condition', () => {
    const scope = 'degraded-only';
    const defsDir = path.join(tmpRoot, scope, 'defs');

    seedProgramDefinition(defsDir, {
      programId: 'degraded-program',
      cohortId: 'aave-risk',
      displayName: 'Degraded Program',
      cadence: 'signal_driven',
      enabled: true,
      lifecycleState: 'active',
      investigationTemplates: ['protocol-risk-investigation'],
      launchConditions: [{ kind: 'cohort_health', health: 'degraded' }]
    });

    const root = path.join(tmpRoot, scope);
    const engine = createCohortProgramLaunchEngine({
      cohortProgramDefinitionsDir: defsDir,
      cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts'),
      investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations'),
      investigationsRootDir: path.join(root, 'investigations'),
      signalsRootDir: path.join(root, 'signals'),
      cohortProjection: {
        projectOne: () => ({
          cohortId: 'aave-risk',
          cohort: {
            cohortId: 'aave-risk',
            cohortType: 'protocol-risk',
            subjectKey: 'aave',
            linkedInvestigations: [],
            linkedSyntheses: [],
            readinessState: 'incomplete',
            healthState: 'degraded',
            strengths: [],
            limitations: []
          },
          conflicts: [],
          reportPreview: {},
          statusPreview: {}
        })
      } as any,
      now: () => new Date('2026-03-11T12:15:00.000Z')
    });

    const run = engine.runProgram({ programId: 'degraded-program', slot: 'daily:2026-03-11' });

    expect(run.eligibility.eligible).toBe(true);
    expect(run.matchedConditionKinds).toContain('cohort_health');
  });
});
