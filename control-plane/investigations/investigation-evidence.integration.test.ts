import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalStore } from '../signals/signal-store.ts';

import { createEvidenceStore } from './evidence-store.ts';
import { createInvestigationExecutor } from './investigation-executor.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigation-evidence-integration');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeDefinition(filePath: string, options: {
  analyzeNextTick?: boolean;
} = {}): void {
  writeJson(filePath, {
    investigationDefinitionId: 'liquidity-drain-investigation',
    sourceSignalType: 'liquidity_drain',
    sourceTriggerId: 'liquidity-drain-investigation',
    phases: [
      { phaseId: 'intake', kind: 'intake', requiredInputs: [], produces: [] },
      { phaseId: 'gather', kind: 'gather', requiredInputs: [], produces: [] },
      {
        phaseId: 'analyze',
        kind: 'analyze',
        requiredInputs: [],
        produces: [],
        ...(options.analyzeNextTick ? { executionMode: 'next_tick', minDelaySlots: 1 } : {})
      },
      { phaseId: 'synthesize', kind: 'synthesize', requiredInputs: [], produces: [] },
      { phaseId: 'finalize', kind: 'finalize', requiredInputs: [], produces: [] }
    ],
    outputArtifacts: ['investigation-report.json', 'investigation-report.md'],
    completionCriteria: ['all_phases_completed'],
    dedupeStrategy: 'definition_signal_slot'
  });
}

function seedSignal(rootDir: string): void {
  const signalStore = createSignalStore({ rootDir });
  signalStore.appendSignal({
    signalType: 'liquidity_drain',
    sourceMission: 'defi-liquidity-scan',
    dataset: 'protocol_tvl_timeseries',
    metadata: { liquidityDropPercent: 12, protocol: 'Aave' },
    slot: 'interval_hours:6:2026-03-10T12:00Z',
    dedupeKey: 'signal-key',
    logDate: '2026-03-10'
  });
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('investigation evidence integration', () => {
  it('T-INV-EINT1 accumulates evidence across cycles and includes confidence in final report', () => {
    const defsDir = path.join(tmpRoot, 'defs-1');
    const signalsRootDir = path.join(tmpRoot, 'signals-1');
    const investigationsRootDir = path.join(tmpRoot, 'investigations-1');
    const artifactsRoot = path.join(tmpRoot, 'artifacts-1', 'investigations');

    writeDefinition(path.join(defsDir, 'liquidity.json'), { analyzeNextTick: true });
    seedSignal(signalsRootDir);

    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir,
      investigationsRootDir,
      investigationArtifactsRoot: artifactsRoot
    });

    const started = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key'
    });
    expect(started.record.status).toBe('scheduled_resume');

    const partialEvidence = createEvidenceStore({ artifactsRoot }).loadEvidence(started.record.investigationRunId);
    expect(partialEvidence.length).toBeGreaterThan(0);

    executor.advanceDueInvestigations({ schedulerSlot: 'interval_hours:6:2026-03-10T18:00Z' });

    const complete = executor.getInvestigation(started.record.investigationRunId);
    expect(complete.status).toBe('completed');
    const evidence = createEvidenceStore({ artifactsRoot }).loadEvidence(started.record.investigationRunId);
    expect(evidence.length).toBeGreaterThan(partialEvidence.length);

    const report = JSON.parse(fs.readFileSync(path.join(artifactsRoot, started.record.investigationRunId, 'investigation-report.json'), 'utf8')) as Record<string, unknown>;
    expect(report.reportConfidence).toBeTruthy();
    expect(report.evidenceBackedFindings).toBeTruthy();
  });

  it('T-INV-EINT2 surfaces counter-evidence and lowers confidence', () => {
    const defsDir = path.join(tmpRoot, 'defs-2');
    const signalsRootDir = path.join(tmpRoot, 'signals-2');
    const investigationsRootDir = path.join(tmpRoot, 'investigations-2');
    const artifactsRoot = path.join(tmpRoot, 'artifacts-2', 'investigations');

    writeDefinition(path.join(defsDir, 'liquidity.json'));
    seedSignal(signalsRootDir);

    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir,
      investigationsRootDir,
      investigationArtifactsRoot: artifactsRoot,
      phaseExecutor(input) {
        const dir = path.join(artifactsRoot, input.runId);
        fs.mkdirSync(dir, { recursive: true });

        if (input.phase.phaseId === 'gather') {
          const filePath = path.join(dir, 'gather-custom.json');
          writeJson(filePath, {
            dataset: 'protocol_tvl_timeseries',
            signalMetadata: { liquidityDropPercent: 12 },
            counterEvidence: ['conflicting liquidity source']
          });
          return { artifacts: [filePath], findings: ['finding-1'] };
        }

        if (input.phase.phaseId === 'analyze') {
          const filePath = path.join(dir, 'analyze-custom.json');
          writeJson(filePath, { signalMetadata: { liquidityDropPercent: 12 } });
          return { artifacts: [filePath], findings: ['finding-1'] };
        }

        return { artifacts: [], findings: ['finding-1'] };
      }
    });

    const result = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key'
    });

    expect(result.record.status).toBe('completed');
    const projection = JSON.parse(fs.readFileSync(path.join(artifactsRoot, result.record.investigationRunId, 'evidence', 'confidence-projection.json'), 'utf8')) as Record<string, unknown>;
    const reportConfidence = projection.reportConfidence as Record<string, unknown>;
    expect((reportConfidence.limitations as string[]).some((entry) => entry.includes('counter-evidence'))).toBe(true);
    expect(Number(reportConfidence.confidenceScore)).toBeLessThan(90);
  });

  it('T-INV-EINT3 minimal evidence with unresolved gaps produces low confidence', () => {
    const defsDir = path.join(tmpRoot, 'defs-3');
    const signalsRootDir = path.join(tmpRoot, 'signals-3');
    const investigationsRootDir = path.join(tmpRoot, 'investigations-3');
    const artifactsRoot = path.join(tmpRoot, 'artifacts-3', 'investigations');

    writeDefinition(path.join(defsDir, 'liquidity.json'));
    seedSignal(signalsRootDir);

    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir,
      investigationsRootDir,
      investigationArtifactsRoot: artifactsRoot,
      phaseExecutor(input) {
        const dir = path.join(artifactsRoot, input.runId);
        fs.mkdirSync(dir, { recursive: true });

        if (input.phase.phaseId === 'gather') {
          const filePath = path.join(dir, 'gather-minimal.json');
          writeJson(filePath, {
            dataset: 'protocol_tvl_timeseries',
            unresolvedGaps: ['missing exchange-level decomposition', 'insufficient historical depth']
          });
          return { artifacts: [filePath], findings: ['finding-1'] };
        }

        return { artifacts: [], findings: [] };
      }
    });

    const result = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key'
    });

    const projection = JSON.parse(fs.readFileSync(path.join(artifactsRoot, result.record.investigationRunId, 'evidence', 'confidence-projection.json'), 'utf8')) as Record<string, unknown>;
    const reportConfidence = projection.reportConfidence as Record<string, unknown>;
    expect(reportConfidence.confidenceBand).toBe('low');
  });

  it('T-INV-EINT4 regression path keeps lifecycle semantics intact', () => {
    const defsDir = path.join(tmpRoot, 'defs-4');
    const signalsRootDir = path.join(tmpRoot, 'signals-4');
    const investigationsRootDir = path.join(tmpRoot, 'investigations-4');
    const artifactsRoot = path.join(tmpRoot, 'artifacts-4', 'investigations');

    writeDefinition(path.join(defsDir, 'liquidity.json'));
    seedSignal(signalsRootDir);

    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir,
      investigationsRootDir,
      investigationArtifactsRoot: artifactsRoot
    });

    const result = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key'
    });

    expect(result.status).toBe('started');
    expect(result.record.status).toBe('completed');
    expect(fs.existsSync(path.join(artifactsRoot, result.record.investigationRunId, 'investigation-report.md'))).toBe(true);
  });
});
