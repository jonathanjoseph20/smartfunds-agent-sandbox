import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';

import { createInvestigationStore } from './investigation-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigations-store');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('investigation store', () => {
  it('T-INV-S1 persists append-only event history and stable projection', () => {
    const store = createInvestigationStore({ rootDir: path.join(tmpRoot, 'investigations') });

    store.appendEvent({
      logDate: '2026-03-10',
      event: {
        eventType: 'INVESTIGATION_CREATED',
        investigationRunId: 'run-1',
        dedupeKey: 'dedupe-1',
        investigationDefinitionId: 'liquidity-drain-investigation',
        sourceSignalReference: 'signal-1',
        sourceSignalType: 'liquidity_drain',
        sourceTriggerId: 'liquidity-drain-investigation',
        sourceTriggerReference: 'trigger:liquidity-drain-investigation:signal-1',
        slot: 'interval_hours:6:2026-03-10T12:00Z',
        associatedMissionReferences: ['defi-liquidity-scan']
      }
    });
    store.appendEvent({
      logDate: '2026-03-10',
      event: {
        eventType: 'PHASE_STARTED',
        investigationRunId: 'run-1',
        phaseId: 'intake',
        phaseKind: 'intake'
      }
    });
    store.appendEvent({
      logDate: '2026-03-10',
      event: {
        eventType: 'PHASE_COMPLETED',
        investigationRunId: 'run-1',
        phaseId: 'intake',
        phaseKind: 'intake',
        findings: ['intake_confirmed:liquidity_drain']
      }
    });

    const record = store.getInvestigation('run-1');
    expect(record.status).toBe('running');
    expect(record.currentPhaseId).toBe('intake');
    expect(record.completedPhaseIds).toEqual(['intake']);

    const logPath = path.join(tmpRoot, 'investigations', '2026-03-10', 'investigation-events.json');
    const raw = fs.readFileSync(logPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown[];
    expect(raw).toBe(`${canonicalStringify(parsed)}\n`);
  });

  it('T-INV-S2 records deterministic failure state', () => {
    const store = createInvestigationStore({ rootDir: path.join(tmpRoot, 'investigations') });

    store.appendEvent({
      logDate: '2026-03-10',
      event: {
        eventType: 'INVESTIGATION_CREATED',
        investigationRunId: 'run-2',
        dedupeKey: 'dedupe-2',
        investigationDefinitionId: 'yield-anomaly-investigation',
        sourceSignalReference: 'signal-2',
        sourceSignalType: 'yield_anomaly',
        slot: 'interval_hours:6:2026-03-10T12:00Z',
        associatedMissionReferences: ['defi-yield-report']
      }
    });
    store.appendEvent({
      logDate: '2026-03-10',
      event: {
        eventType: 'INVESTIGATION_FAILED',
        investigationRunId: 'run-2',
        phaseId: 'gather',
        reason: 'forced_phase_failure'
      }
    });

    expect(store.getInvestigation('run-2')).toMatchObject({
      investigationRunId: 'run-2',
      status: 'failed',
      currentPhaseId: 'gather',
      failureReason: 'forced_phase_failure'
    });
  });

  it('T-INV-S3 projects waiting and retry metadata deterministically', () => {
    const store = createInvestigationStore({ rootDir: path.join(tmpRoot, 'investigations') });

    store.appendEvent({
      logDate: '2026-03-10',
      event: {
        eventType: 'INVESTIGATION_CREATED',
        investigationRunId: 'run-3',
        dedupeKey: 'dedupe-3',
        investigationDefinitionId: 'liquidity-drain-investigation',
        sourceSignalReference: 'signal-3',
        sourceSignalType: 'liquidity_drain',
        slot: 'interval_hours:6:2026-03-10T12:00Z',
        associatedMissionReferences: ['defi-liquidity-scan']
      }
    });
    store.appendEvent({
      logDate: '2026-03-10',
      event: {
        eventType: 'PHASE_RETRY_SCHEDULED',
        investigationRunId: 'run-3',
        phaseId: 'gather',
        reason: 'transient_failure',
        retryIndex: 1,
        nextEligibleSlot: 'interval_hours:6:2026-03-10T18:00Z',
        schedulerSlot: 'interval_hours:6:2026-03-10T12:00Z'
      }
    });
    store.appendEvent({
      logDate: '2026-03-10',
      event: {
        eventType: 'LIFECYCLE_TRANSITION_RECORDED',
        investigationRunId: 'run-3',
        phaseId: 'gather',
        fromStatus: 'running',
        toStatus: 'retry_pending',
        reason: 'transient_failure',
        schedulerSlot: 'interval_hours:6:2026-03-10T12:00Z',
        nextEligibleSlot: 'interval_hours:6:2026-03-10T18:00Z',
        retryIndex: 1
      }
    });

    expect(store.getInvestigation('run-3')).toMatchObject({
      status: 'retry_pending',
      currentPhaseId: 'gather',
      nextEligibleSlot: 'interval_hours:6:2026-03-10T18:00Z',
      retryCountByPhase: { gather: 1 }
    });
  });
});
