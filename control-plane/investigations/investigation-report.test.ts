import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createInvestigationRegistry } from './investigation-registry.ts';
import { writeInvestigationReport } from './investigation-report.ts';
import type { InvestigationEventRecord, InvestigationRecord } from './investigation-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigations-report');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('investigation report generation', () => {
  it('T-INV-RPT1 writes stable machine-readable and markdown reports', () => {
    const registry = createInvestigationRegistry();
    const definition = registry.getInvestigation('liquidity-drain-investigation');
    const runRoot = path.join(tmpRoot, 'artifacts', 'run-1');
    fs.mkdirSync(runRoot, { recursive: true });
    fs.writeFileSync(path.join(runRoot, 'gather-evidence.json'), JSON.stringify({
      signalMetadata: {
        protocol: 'Aave',
        liquidityDropPercent: 12
      }
    }), 'utf8');

    const record: InvestigationRecord = {
      investigationRunId: 'run-1',
      dedupeKey: 'dedupe-1',
      investigationDefinitionId: definition.investigationDefinitionId,
      sourceSignalReference: 'signal-1',
      sourceSignalType: 'liquidity_drain',
      sourceTriggerId: 'liquidity-drain-investigation',
      sourceTriggerReference: 'trigger:liquidity-drain-investigation:signal-1',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      logDate: '2026-03-10',
      status: 'completed',
      currentPhaseId: 'finalize',
      completedPhaseIds: ['analyze', 'finalize', 'gather', 'intake', 'synthesize'],
      artifactPaths: [path.join(runRoot, 'gather-evidence.json')],
      finalReportPath: path.join(runRoot, 'investigation-report.md'),
      associatedMissionReferences: ['defi-liquidity-scan'],
      findings: ['liquidity_drop:Aave:12']
    };

    const history: InvestigationEventRecord[] = [
      { sequence: 1, logDate: '2026-03-10', eventType: 'INVESTIGATION_CREATED', investigationRunId: 'run-1', dedupeKey: 'dedupe-1', investigationDefinitionId: definition.investigationDefinitionId, sourceSignalReference: 'signal-1', sourceSignalType: 'liquidity_drain', sourceTriggerId: 'liquidity-drain-investigation', sourceTriggerReference: 'trigger:liquidity-drain-investigation:signal-1', slot: 'interval_hours:6:2026-03-10T12:00Z', associatedMissionReferences: ['defi-liquidity-scan'] },
      { sequence: 2, logDate: '2026-03-10', eventType: 'PHASE_COMPLETED', investigationRunId: 'run-1', phaseId: 'gather', phaseKind: 'gather', findings: ['liquidity_drop:Aave:12'] }
    ];

    const report = writeInvestigationReport({
      artifactsRoot: path.join(tmpRoot, 'artifacts'),
      record,
      definition,
      history
    });

    expect(fs.readFileSync(report.jsonPath, 'utf8')).toContain('"investigationRunId":"run-1"');
    expect(fs.readFileSync(report.markdownPath, 'utf8')).toContain('Liquidity contraction detected for Aave');
  });
});
