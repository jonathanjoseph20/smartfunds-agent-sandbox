import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildInvestigationCompletionStatus } from './completion-status.ts';
import { createInvestigationExecutor } from './investigation-executor.ts';
import { createInvestigationInspection } from './investigation-inspection.ts';
import { createSignalEmitter } from '../signals/signal-emitter.ts';
import { createSignalStore } from '../signals/signal-store.ts';
import type { ConfidenceSnapshot, InvestigationDelta, InvestigationRevisionRecord } from './revision-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigation-completion-integration');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeDefinition(filePath: string): void {
  writeJson(filePath, {
    investigationDefinitionId: 'liquidity-drain-investigation',
    sourceSignalType: 'liquidity_drain',
    sourceTriggerId: 'liquidity-drain-investigation',
    phases: [
      { phaseId: 'intake', kind: 'intake', requiredInputs: [], produces: [] },
      { phaseId: 'gather', kind: 'gather', requiredInputs: [], produces: [] },
      { phaseId: 'analyze', kind: 'analyze', requiredInputs: [], produces: [] },
      { phaseId: 'synthesize', kind: 'synthesize', requiredInputs: [], produces: [] },
      { phaseId: 'finalize', kind: 'finalize', requiredInputs: [], produces: [] }
    ],
    outputArtifacts: ['investigation-report.json', 'investigation-report.md'],
    completionCriteria: ['all_phases_completed', 'final_report_written'],
    completionCriteriaConfig: {
      minimumConfidenceBand: 'medium',
      requireConvergenceState: 'converging'
    },
    dedupeStrategy: 'definition_signal_slot'
  });
}

function revision(number: number): InvestigationRevisionRecord {
  return {
    revisionId: `revision-${String(number).padStart(4, '0')}`,
    investigationRunId: 'run-1',
    revisionNumber: number,
    reportPath: '/tmp/report.md',
    findingsSnapshotPath: '/tmp/findings.json',
    confidenceSnapshotPath: '/tmp/confidence.json'
  };
}

function confidence(score: number, limitations: string[] = []): ConfidenceSnapshot {
  return {
    investigationRunId: 'run-1',
    reportConfidenceBand: score >= 70 ? 'high' : (score >= 45 ? 'medium' : 'low'),
    reportConfidenceScore: score,
    reportStrengths: score >= 45 ? ['supporting evidence records: 2'] : [],
    reportLimitations: limitations,
    findings: []
  };
}

function delta(changeType: InvestigationDelta['deltas'][number]['changeType']): InvestigationDelta {
  return {
    investigationRunId: 'run-1',
    revisionId: 'revision-0002',
    previousRevisionId: 'revision-0001',
    deltas: [{ findingId: 'f1', changeType, reason: changeType }]
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('completion and convergence integration', () => {
  it('T-INV-CINT1 long-running investigation stabilizes and emits ready_to_finalize once on transition', () => {
    const defsDir = path.join(tmpRoot, 'defs');
    const signalsRoot = path.join(tmpRoot, 'signals');
    const investigationsRoot = path.join(tmpRoot, 'investigations');
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'investigations');
    writeDefinition(path.join(defsDir, 'liquidity.json'));

    createSignalStore({ rootDir: signalsRoot }).appendSignal({
      signalType: 'liquidity_drain',
      sourceMission: 'defi-liquidity-scan',
      dataset: 'protocol_tvl_timeseries',
      metadata: { protocol: 'Aave', liquidityDropPercent: 12 },
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      dedupeKey: 'signal-key',
      logDate: '2026-03-10'
    });

    let finalizeAttempts = 0;
    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir: signalsRoot,
      investigationsRootDir: investigationsRoot,
      investigationArtifactsRoot: artifactsRoot,
      phaseExecutor(input) {
        if (input.phase.phaseId === 'finalize') {
          finalizeAttempts += 1;
          return {
            artifacts: [],
            findings: ['phase:finalize'],
            outcome: 'scheduled_resume',
            reason: 'awaiting_additional_cycle_confirmation',
            nextEligibleSlot: finalizeAttempts === 1
              ? 'interval_hours:6:2026-03-10T12:30Z'
              : 'interval_hours:6:2026-03-10T13:00Z'
          };
        }

        const artifactPath = path.join(input.artifactsRoot, input.runId, `${input.phase.phaseId}.json`);
        writeJson(artifactPath, {
          dataset: 'protocol_tvl_timeseries',
          signalMetadata: { liquidityDropPercent: 12 }
        });
        return {
          artifacts: [artifactPath],
          findings: ['finding:liquidity']
        };
      }
    });

    const started = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key'
    });
    expect(started.record.status).toBe('scheduled_resume');

    executor.advanceDueInvestigations({ schedulerSlot: 'interval_hours:6:2026-03-10T12:30Z' });

    const inspection = createInvestigationInspection({
      definitionsDir: defsDir,
      rootDir: investigationsRoot,
      artifactsRoot
    });
    const status = inspection.inspectCompletionStatus(started.record.investigationRunId);
    expect(status.readinessState).toBe('ready_to_finalize');

    const history = inspection.inspectInvestigation(started.record.investigationRunId).history;
    const signals = history.filter((event) => event.eventType === 'INVESTIGATION_FINALIZATION_SIGNAL_EMITTED');
    const readySignals = signals.filter((event) => event.signalType === 'investigation_ready_to_finalize');
    expect(readySignals).toHaveLength(1);
  });

  it('T-INV-CINT2 counter evidence appears and health degrades deterministically', () => {
    const status = buildInvestigationCompletionStatus({
      investigationRunId: 'run-1',
      lifecycle: { status: 'running', completedPhaseIds: ['intake', 'gather'] },
      revisions: [revision(1), revision(2)],
      deltas: [delta('counter_evidence_added')],
      confidenceSnapshots: [confidence(60), confidence(45, ['counter-evidence records: 1'])],
      evidence: {
        supportingEvidenceCount: 2,
        counterEvidenceCount: 1,
        unresolvedGapCount: 0,
        unresolvedCriticalGapCount: 0
      }
    });

    expect(status.healthState).toBe('degraded_by_counter_evidence');
    expect(status.readinessState).toBe('unhealthy');
  });

  it('T-INV-CINT3 weak evidence remains inconclusive', () => {
    const status = buildInvestigationCompletionStatus({
      investigationRunId: 'run-1',
      lifecycle: { status: 'running', completedPhaseIds: ['intake'] },
      revisions: [revision(1)],
      deltas: [],
      confidenceSnapshots: [confidence(30, ['no supporting evidence records'])],
      evidence: {
        supportingEvidenceCount: 0,
        counterEvidenceCount: 0,
        unresolvedGapCount: 0,
        unresolvedCriticalGapCount: 0
      }
    });

    expect(status.readinessState).toBe('inconclusive');
  });

  it('T-INV-CINT4 waiting dataset is classified as waiting_normally', () => {
    const status = buildInvestigationCompletionStatus({
      investigationRunId: 'run-1',
      lifecycle: {
        status: 'awaiting_data',
        completedPhaseIds: ['intake', 'gather'],
        waitingReason: 'awaiting_new_dataset_observation'
      },
      revisions: [revision(1), revision(2)],
      deltas: [delta('unchanged')],
      confidenceSnapshots: [confidence(55), confidence(55)],
      evidence: {
        supportingEvidenceCount: 1,
        counterEvidenceCount: 0,
        unresolvedGapCount: 0,
        unresolvedCriticalGapCount: 0
      }
    });

    expect(status.healthState).toBe('waiting_normally');
  });

  it('T-INV-CINT5 regression: existing revision and report behavior remains intact', () => {
    const emitter = createSignalEmitter({
      signalsRootDir: path.join(tmpRoot, 'signals-reg'),
      triggersRootDir: path.join(tmpRoot, 'triggers-reg'),
      investigationsRootDir: path.join(tmpRoot, 'investigations-reg'),
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts-reg', 'investigations')
    });

    const result = emitter.emitSignal('liquidity_drain', {
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      liquidityDropPercent: 12
    });

    expect(result.status).toBe('persisted');
    const inspections = createInvestigationInspection({
      rootDir: path.join(tmpRoot, 'investigations-reg'),
      artifactsRoot: path.join(tmpRoot, 'artifacts-reg', 'investigations')
    });
    const runs = inspections.listInvestigations();
    expect(runs).toHaveLength(1);
    const run = runs[0];
    expect(run?.status).toBe('completed');
    expect(run?.finalReportPath).toContain('investigation-report.md');
    const revisions = inspections.listRevisions(run?.investigationRunId ?? '');
    expect(revisions.length).toBeGreaterThan(0);
  });
});
