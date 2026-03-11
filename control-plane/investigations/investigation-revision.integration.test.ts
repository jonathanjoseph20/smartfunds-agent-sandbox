import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createInvestigationExecutor } from './investigation-executor.ts';
import { createInvestigationInspection } from './investigation-inspection.ts';
import { createInvestigationRevisionStore } from './investigation-revision-store.ts';
import { createSignalStore } from '../signals/signal-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigation-revision-integration');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeDefinition(definitionsDir: string): void {
  writeJson(path.join(definitionsDir, 'liquidity.json'), {
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
    dedupeStrategy: 'definition_signal_slot'
  });
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('investigation revision integration', () => {
  it('T-INV-RINT1 creates deterministic multi-cycle revision history with delta, trend, and continuity artifacts', () => {
    const definitionsDir = path.join(tmpRoot, 'defs');
    const signalsRootDir = path.join(tmpRoot, 'signals');
    const investigationsRootDir = path.join(tmpRoot, 'investigations');
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'investigations');

    writeDefinition(definitionsDir);

    const signalStore = createSignalStore({ rootDir: signalsRootDir });
    signalStore.appendSignal({
      signalType: 'liquidity_drain',
      sourceMission: 'defi-liquidity-scan',
      dataset: 'protocol_tvl_timeseries',
      metadata: { liquidityDropPercent: 12, protocol: 'Aave' },
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      dedupeKey: 'signal-key',
      logDate: '2026-03-10'
    });

    const phaseAttempts: Record<string, number> = {};
    const executor = createInvestigationExecutor({
      definitionsDir,
      signalsRootDir,
      investigationsRootDir,
      investigationArtifactsRoot: artifactsRoot,
      phaseExecutor(input) {
        const attempt = phaseAttempts[input.phase.phaseId] ?? 0;
        phaseAttempts[input.phase.phaseId] = attempt + 1;

        if (input.phase.phaseId === 'analyze' && attempt === 0) {
          return {
            artifacts: [],
            findings: ['phase:analyze'],
            outcome: 'scheduled_resume',
            reason: 'pause_before_analyze',
            nextEligibleSlot: 'interval_hours:6:2026-03-10T12:30Z'
          };
        }

        if (input.phase.phaseId === 'synthesize' && attempt === 0) {
          return {
            artifacts: [],
            findings: ['phase:synthesize'],
            outcome: 'scheduled_resume',
            reason: 'pause_before_synthesize',
            nextEligibleSlot: 'interval_hours:6:2026-03-10T13:00Z'
          };
        }

        return {
          artifacts: [],
          findings: [`phase:${input.phase.phaseId}`]
        };
      }
    });

    const started = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key'
    });
    expect(started.record.status).toBe('scheduled_resume');

    const secondCycle = executor.advanceDueInvestigations({ schedulerSlot: 'interval_hours:6:2026-03-10T12:30Z' });
    expect(secondCycle.advancedInvestigations).toEqual([started.record.investigationRunId]);
    expect(executor.getInvestigation(started.record.investigationRunId).status).toBe('scheduled_resume');

    const thirdCycle = executor.advanceDueInvestigations({ schedulerSlot: 'interval_hours:6:2026-03-10T13:00Z' });
    expect(thirdCycle.advancedInvestigations).toEqual([started.record.investigationRunId]);
    expect(executor.getInvestigation(started.record.investigationRunId).status).toBe('completed');

    const revisionStore = createInvestigationRevisionStore({ artifactsRoot });
    const revisions = revisionStore.listRevisions(started.record.investigationRunId);
    expect(revisions.map((entry) => entry.revisionId)).toEqual(['revision-0001', 'revision-0002', 'revision-0003']);

    const firstDelta = revisionStore.loadDelta(revisions[0]);
    const secondDelta = revisionStore.loadDelta(revisions[1]);
    const latestDelta = revisionStore.loadDelta(revisions[2]);
    const continuitySummary = revisionStore.loadContinuitySummary(revisions[2]);

    expect(firstDelta?.deltas.some((entry) => entry.changeType === 'added')).toBe(true);
    expect(secondDelta?.deltas.some((entry) => entry.changeType === 'added')).toBe(true);
    expect(latestDelta?.deltas.some((entry) => entry.changeType === 'added')).toBe(true);

    expect(continuitySummary?.revisionCount).toBe(3);
    expect(continuitySummary?.continuityState).toBe('materially_changed');
    expect(continuitySummary?.confidenceTrend).toBe('flat');

    const inspection = createInvestigationInspection({
      definitionsDir,
      rootDir: investigationsRootDir,
      artifactsRoot
    });
    expect(inspection.inspectTrend(started.record.investigationRunId).confidenceTrend).toBe('flat');
    expect(inspection.inspectLatestDelta(started.record.investigationRunId).delta).toEqual(latestDelta);
  });
});
