import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalEmitter } from '../signals/signal-emitter.ts';
import { createSignalStore } from '../signals/signal-store.ts';
import { createInvestigationStore } from '../investigations/investigation-store.ts';
import { computeInvestigationDedupeKey, computeInvestigationRunId } from '../investigations/investigation-deduper.ts';

import { createCohortInspection } from './cohort-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-cohort-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function createInspection(scope: string) {
  const root = path.join(tmpRoot, scope);
  return createCohortInspection({
    cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts'),
    synthesisArtifactsRoot: path.join(root, 'artifacts', 'syntheses'),
    investigationsRootDir: path.join(root, 'investigations'),
    signalsRootDir: path.join(root, 'signals'),
    investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations')
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

describe('cohort integration', () => {
  it('T-COH-INT1 full pipeline links investigations and syntheses to cohort', () => {
    const scope = 'full-pipeline';
    const emitter = createEmitter(scope);

    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      riskLevel: 'high'
    });
    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T18:00Z',
      protocol: 'Aave',
      riskLevel: 'high'
    });

    const inspection = createInspection(scope);
    const details = inspection.inspectCohort('aave-risk');

    expect(details.linkedInvestigations.length).toBeGreaterThan(0);
    expect(details.linkedSyntheses.length).toBeGreaterThan(0);
  });

  it('T-COH-INT2 conflict-heavy cohort classifies health as conflicted', () => {
    const scope = 'conflicted';
    const emitter = createEmitter(scope);

    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      riskLevel: 'high'
    });
    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T18:00Z',
      protocol: 'Aave',
      riskLevel: 'low'
    });

    const inspection = createInspection(scope);
    const status = inspection.inspectStatus('aave-risk');

    expect(status.health).toBe('conflicted');
  });

  it('T-COH-INT3 partial readiness cohort classifies readiness as incomplete', () => {
    const scope = 'partial';
    const root = path.join(tmpRoot, scope);
    const emitter = createEmitter(scope);

    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      riskLevel: 'high'
    });

    const signalStore = createSignalStore({ rootDir: path.join(root, 'signals') });
    signalStore.appendSignal({
      signalType: 'protocol_risk',
      sourceMission: 'defi-governance-events',
      dataset: 'protocol_risk_feed',
      metadata: { protocol: 'Aave', riskLevel: 'high' },
      slot: 'interval_hours:6:2026-03-10T20:00Z',
      dedupeKey: 'manual-signal-aave-pending',
      logDate: '2026-03-10'
    });

    const dedupeKey = computeInvestigationDedupeKey({
      investigationDefinitionId: 'protocol-risk-investigation',
      sourceSignalReference: 'manual-signal-aave-pending',
      slot: 'interval_hours:6:2026-03-10T20:00Z'
    });

    const runId = computeInvestigationRunId(dedupeKey);
    const investigationStore = createInvestigationStore({ rootDir: path.join(root, 'investigations') });
    investigationStore.appendEvent({
      logDate: '2026-03-10',
      event: {
        eventType: 'INVESTIGATION_CREATED',
        investigationRunId: runId,
        dedupeKey,
        investigationDefinitionId: 'protocol-risk-investigation',
        sourceSignalReference: 'manual-signal-aave-pending',
        sourceSignalType: 'protocol_risk',
        sourceTriggerId: 'protocol-risk-investigation',
        sourceTriggerReference: 'trigger:protocol-risk-investigation:manual-signal-aave-pending:interval_hours:6:2026-03-10T20:00Z',
        slot: 'interval_hours:6:2026-03-10T20:00Z',
        logDate: '2026-03-10',
        associatedMissionReferences: ['defi-governance-events']
      }
    });

    const inspection = createInspection(scope);
    const status = inspection.inspectStatus('aave-risk');

    expect(status.readiness).toBe('incomplete');
  });

  it('T-COH-INT4 projected cohort remains unchanged after materialization and matches persisted report', () => {
    const scope = 'parity';
    const emitter = createEmitter(scope);

    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      riskLevel: 'high'
    });

    const inspection = createInspection(scope);
    const statusBefore = inspection.inspectStatus('aave-risk');
    const projected = inspection.projectCohort('aave-risk');

    const first = inspection.materializeCohort('aave-risk');
    const statusAfterFirst = inspection.inspectStatus('aave-risk');
    const projectedAfterFirst = inspection.projectCohort('aave-risk');
    const second = inspection.materializeCohort('aave-risk');
    const statusAfterSecond = inspection.inspectStatus('aave-risk');
    const projectedAfterSecond = inspection.projectCohort('aave-risk');

    const report = JSON.parse(fs.readFileSync(first.reportPath, 'utf8')) as {
      cohort: {
        cohortId: string;
        readinessState: string;
        healthState: string;
      };
    };

    expect(statusAfterFirst).toEqual(statusBefore);
    expect(statusAfterSecond).toEqual(statusBefore);
    expect(projectedAfterFirst).toEqual(projected);
    expect(projectedAfterSecond).toEqual(projected);
    expect(report.cohort.cohortId).toBe(projected.cohortId);
    expect(report.cohort.readinessState).toBe(projected.readinessState);
    expect(report.cohort.healthState).toBe(projected.healthState);
    expect(first).toEqual(second);
  });
});
