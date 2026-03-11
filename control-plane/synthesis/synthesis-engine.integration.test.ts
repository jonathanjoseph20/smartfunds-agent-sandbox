import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { computeInvestigationDedupeKey, computeInvestigationRunId } from '../investigations/investigation-deduper.ts';
import { createInvestigationStore } from '../investigations/investigation-store.ts';
import { createSignalEmitter } from '../signals/signal-emitter.ts';
import { createSignalStore } from '../signals/signal-store.ts';

import { createSynthesisInspection } from './synthesis-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-synthesis-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function createInspection(scope: string) {
  const root = path.join(tmpRoot, scope);
  return createSynthesisInspection({
    synthesisRootDir: path.join(root, 'syntheses'),
    synthesisArtifactsRoot: path.join(root, 'artifacts', 'synthesis'),
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

describe('synthesis integration', () => {
  it('T-SYN-INT1 positive path builds synthesis artifact with aggregate conclusions', () => {
    const emitter = createEmitter('positive');

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

    const inspection = createInspection('positive');
    const list = inspection.listSynthesisSets();
    const target = list.find((entry) => entry.synthesisType === 'protocol-risk-synthesis' && entry.subjectKey === 'protocol:aave');

    expect(target).toBeTruthy();
    expect(target?.linkedInvestigationCount).toBe(2);

    const report = inspection.inspectSynthesis(target!.synthesisId);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.conflicts).toHaveLength(0);

    const jsonPath = report.artifactPaths.find((entry) => entry.endsWith('synthesis-report.json'));
    expect(jsonPath && fs.existsSync(jsonPath)).toBe(true);
  });

  it('T-SYN-INT2 conflict path surfaces contradiction and inconclusive status', () => {
    const emitter = createEmitter('conflict');

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

    const inspection = createInspection('conflict');
    const list = inspection.listSynthesisSets();
    const target = list.find((entry) => entry.synthesisType === 'protocol-risk-synthesis' && entry.subjectKey === 'protocol:aave');
    const report = inspection.inspectSynthesis(target!.synthesisId);

    expect(report.status).toBe('inconclusive');
    expect(report.conflicts.length).toBeGreaterThan(0);
    expect(report.confidence.unresolvedConflicts.length).toBeGreaterThan(0);
  });

  it('T-SYN-INT3 partial readiness remains active with explicit limitations', () => {
    const scope = 'partial';
    const root = path.join(tmpRoot, scope);
    const emitter = createEmitter(scope);

    const first = emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      riskLevel: 'high'
    });
    expect(first.status).toBe('persisted');

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
    const store = createInvestigationStore({ rootDir: path.join(root, 'investigations') });
    store.appendEvent({
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
    const list = inspection.listSynthesisSets();
    const target = list.find((entry) => entry.synthesisType === 'protocol-risk-synthesis' && entry.subjectKey === 'protocol:aave');
    const report = inspection.inspectSynthesis(target!.synthesisId);

    expect(report.status).toBe('active');
    expect(report.linkedInvestigations.length).toBeGreaterThanOrEqual(2);
    expect(report.confidence.weakeningFactors.some((factor) => factor.includes('incomplete investigations'))).toBe(true);
  });

  it('T-SYN-INT4 regression path preserves signal trigger investigation flow semantics', () => {
    const scope = 'regression';
    const root = path.join(tmpRoot, scope);
    const emitter = createEmitter(scope);

    const emitted = emitter.emitSignal('liquidity_drain', {
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      liquidityDropPercent: 12
    });

    expect(emitted.status).toBe('persisted');

    const inspection = createInspection(scope);
    inspection.listSynthesisSets();

    const signalLogPath = path.join(root, 'signals', '2026-03-10', 'signal-log.json');
    const triggerLogPath = path.join(root, 'triggers', '2026-03-10', 'trigger-log.json');
    const investigationLogPath = path.join(root, 'investigations', '2026-03-10', 'investigation-events.json');

    expect(fs.existsSync(signalLogPath)).toBe(true);
    expect(fs.existsSync(triggerLogPath)).toBe(true);
    expect(fs.existsSync(investigationLogPath)).toBe(true);

    const history = JSON.parse(fs.readFileSync(investigationLogPath, 'utf8')) as Array<Record<string, unknown>>;
    expect(history.some((entry) => entry.eventType === 'INVESTIGATION_COMPLETED')).toBe(true);
  });
});
