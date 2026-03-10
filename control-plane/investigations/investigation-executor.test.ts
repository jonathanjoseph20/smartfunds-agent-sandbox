import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalStore } from '../signals/signal-store.ts';

import { computeInvestigationDedupeKey } from './investigation-deduper.ts';
import { createInvestigationExecutor } from './investigation-executor.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigations-executor');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('investigation executor', () => {
  it('T-INV-E1 creates investigation, advances phases, and writes final reports', () => {
    const signalsRootDir = path.join(tmpRoot, 'signals');
    const investigationsRootDir = path.join(tmpRoot, 'investigations');
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'investigations');
    const signalStore = createSignalStore({ rootDir: signalsRootDir });

    signalStore.appendSignal({
      signalType: 'liquidity_drain',
      sourceMission: 'defi-liquidity-scan',
      dataset: 'protocol_tvl_timeseries',
      metadata: { liquidityDropPercent: 12, protocol: 'Aave' },
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      dedupeKey: 'signal-key-1',
      logDate: '2026-03-10'
    });

    const executor = createInvestigationExecutor({
      signalsRootDir,
      investigationsRootDir,
      investigationArtifactsRoot: artifactsRoot
    });

    const result = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key-1'
    });

    expect(result.status).toBe('started');
    expect(result.record.status).toBe('completed');
    expect(result.record.completedPhaseIds).toEqual(['analyze', 'finalize', 'gather', 'intake', 'synthesize']);
    expect(result.record.finalReportPath).toBe(path.resolve(artifactsRoot, result.record.investigationRunId, 'investigation-report.md'));
    expect(fs.existsSync(path.resolve(artifactsRoot, result.record.investigationRunId, 'investigation-report.json'))).toBe(true);
  });

  it('T-INV-E2 suppresses duplicate investigation launches with stable dedupe identity', () => {
    const signalsRootDir = path.join(tmpRoot, 'signals');
    const investigationsRootDir = path.join(tmpRoot, 'investigations');
    const signalStore = createSignalStore({ rootDir: signalsRootDir });

    signalStore.appendSignal({
      signalType: 'yield_anomaly',
      sourceMission: 'defi-yield-report',
      dataset: 'yield_rate_history',
      metadata: { yieldChangePercent: 8, protocol: 'Morpho' },
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      dedupeKey: 'signal-key-2',
      logDate: '2026-03-10'
    });

    const executor = createInvestigationExecutor({
      signalsRootDir,
      investigationsRootDir,
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts', 'investigations')
    });

    const first = executor.executeLaunchRequest({
      missionId: 'defi-yield-report',
      triggerId: 'yield-anomaly-investigation',
      sourceSignal: 'signal-key-2'
    });
    const second = executor.executeLaunchRequest({
      missionId: 'defi-yield-report',
      triggerId: 'yield-anomaly-investigation',
      sourceSignal: 'signal-key-2'
    });

    expect(first.status).toBe('started');
    expect(second.status).toBe('duplicate');
    expect(computeInvestigationDedupeKey({
      investigationDefinitionId: 'yield-anomaly-investigation',
      sourceSignalReference: 'signal-key-2',
      slot: 'interval_hours:6:2026-03-10T12:00Z'
    })).toBe(second.record.dedupeKey);
  });

  it('T-INV-E3 records bounded phase failure deterministically', () => {
    const signalsRootDir = path.join(tmpRoot, 'signals');
    const investigationsRootDir = path.join(tmpRoot, 'investigations');
    const signalStore = createSignalStore({ rootDir: signalsRootDir });

    signalStore.appendSignal({
      signalType: 'protocol_risk',
      sourceMission: 'defi-governance-events',
      dataset: 'governance_vote_tracker',
      metadata: { protocol: 'Maker', riskLevel: 'high' },
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      dedupeKey: 'signal-key-3',
      logDate: '2026-03-10'
    });

    const executor = createInvestigationExecutor({
      signalsRootDir,
      investigationsRootDir,
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts', 'investigations'),
      phaseExecutor(input) {
        if (input.phase.kind === 'gather') {
          throw new Error('forced_phase_failure');
        }
        return {
          artifacts: [],
          findings: [`phase:${input.phase.phaseId}`]
        };
      }
    });

    const result = executor.executeLaunchRequest({
      missionId: 'defi-governance-events',
      triggerId: 'protocol-risk-investigation',
      sourceSignal: 'signal-key-3'
    });

    expect(result.status).toBe('failed');
    expect(result.record.status).toBe('failed');
    expect(result.record.failureReason).toBe('forced_phase_failure');
  });
});
