import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { computeInvestigationDedupeKey, computeInvestigationRunId } from '../investigations/investigation-deduper.ts';
import { createInvestigationStore } from '../investigations/investigation-store.ts';
import { createSignalEmitter } from '../signals/signal-emitter.ts';
import { createSignalStore } from '../signals/signal-store.ts';

import { createSynthesisInspection } from './synthesis-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-synthesis-hardening');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function createInspection(scope: string) {
  const root = path.join(tmpRoot, scope);
  return createSynthesisInspection({
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

describe('synthesis hardening integration', () => {
  it('T-SYN-HI1 linked investigations form deterministic synthesis cluster with explainable links', () => {
    const scope = 'cluster';
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
    const target = inspection.listSynthesisSets().find((entry) => entry.subjectKey === 'protocol:aave');
    expect(target).toBeTruthy();

    const why = inspection.inspectWhy(target!.synthesisId);
    expect(why.explanations.length).toBeGreaterThan(0);
    expect(why.explanations.every((entry) => Array.isArray(entry.linkReasons))).toBe(true);
  });

  it('T-SYN-HI2 contradiction-heavy projection is surfaced as inconclusive with classified conflicts', () => {
    const scope = 'conflicts';
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
    const target = inspection.listSynthesisSets().find((entry) => entry.subjectKey === 'protocol:aave');
    const status = inspection.inspectStatus(target!.synthesisId);
    const conflicts = inspection.inspectConflicts(target!.synthesisId);

    expect(status.readinessState).toBe('inconclusive');
    expect(conflicts.conflicts.length).toBeGreaterThan(0);
    expect(conflicts.conflicts.some((entry) => entry.type === 'direct_finding_conflict')).toBe(true);
  });

  it('T-SYN-HI3 partial readiness and projection vs materialization boundary remains explicit', () => {
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
    const target = inspection.listSynthesisSets().find((entry) => entry.subjectKey === 'protocol:aave');
    expect(target).toBeTruthy();

    const status = inspection.inspectStatus(target!.synthesisId);
    expect(status.readinessState === 'active' || status.readinessState === 'incomplete').toBe(true);

    const artifactPath = path.join(root, 'artifacts', 'syntheses', target!.synthesisId, 'synthesis-report.json');
    expect(fs.existsSync(artifactPath)).toBe(false);

    inspection.materializeSynthesis(target!.synthesisId);
    expect(fs.existsSync(artifactPath)).toBe(true);
  });
});
