import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createInvestigationExecutor } from './investigation-executor.ts';
import { createInvestigationScheduler } from './investigation-scheduler.ts';
import { createSignalStore } from '../signals/signal-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigation-scheduler');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeDefinition(defsDir: string): void {
  writeJson(path.join(defsDir, 'liquidity.json'), {
    investigationDefinitionId: 'liquidity-drain-investigation',
    sourceSignalType: 'liquidity_drain',
    sourceTriggerId: 'liquidity-drain-investigation',
    phases: [
      { phaseId: 'intake', kind: 'intake', requiredInputs: [], produces: [] },
      { phaseId: 'gather', kind: 'gather', requiredInputs: [], produces: [] },
      { phaseId: 'analyze', kind: 'analyze', requiredInputs: [], produces: [], executionMode: 'next_tick', minDelaySlots: 1 },
      { phaseId: 'synthesize', kind: 'synthesize', requiredInputs: [], produces: [] },
      { phaseId: 'finalize', kind: 'finalize', requiredInputs: [], produces: [] }
    ],
    outputArtifacts: ['investigation-report.json', 'investigation-report.md'],
    completionCriteria: ['all_phases_completed'],
    dedupeStrategy: 'definition_signal_slot'
  });
}

function seedSignal(signalRoot: string): void {
  const store = createSignalStore({ rootDir: signalRoot });
  store.appendSignal({
    signalType: 'liquidity_drain',
    sourceMission: 'defi-liquidity-scan',
    dataset: 'protocol_tvl_timeseries',
    metadata: { protocol: 'Aave', liquidityDropPercent: 12 },
    slot: 'interval_hours:6:2026-03-10T12:00Z',
    dedupeKey: 'signal-1',
    logDate: '2026-03-10'
  });
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('investigation scheduler seam', () => {
  it('T-INV-SCH1 lists due investigations with deterministic ordering and visibility fields', () => {
    const defsDir = path.join(tmpRoot, 'defs');
    const signalsRoot = path.join(tmpRoot, 'signals');
    const investigationsRoot = path.join(tmpRoot, 'investigations');
    writeDefinition(defsDir);
    seedSignal(signalsRoot);

    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir: signalsRoot,
      investigationsRootDir: investigationsRoot,
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts', 'investigations')
    });

    const started = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-1'
    });

    expect(started.record.status).toBe('scheduled_resume');
    const due = executor.listDueInvestigations({ schedulerSlot: 'interval_hours:6:2026-03-10T18:00Z' });
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      investigationRunId: started.record.investigationRunId,
      dueNow: true,
      dueReason: 'due',
      status: 'scheduled_resume',
      nextPhaseId: 'analyze'
    });
  });

  it('T-INV-SCH2 suppresses duplicate phase advancement in same slot', () => {
    const defsDir = path.join(tmpRoot, 'defs-dup');
    const signalsRoot = path.join(tmpRoot, 'signals-dup');
    const investigationsRoot = path.join(tmpRoot, 'investigations-dup');
    writeDefinition(defsDir);
    seedSignal(signalsRoot);

    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir: signalsRoot,
      investigationsRootDir: investigationsRoot,
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts-dup', 'investigations')
    });

    const started = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-1'
    });

    const scheduler = createInvestigationScheduler({ executor });
    const input = {
      tickTimeUtc: '2026-03-10T18:01:00.000Z',
      evaluations: [{
        scheduleId: 'defi-liquidity-hourly-scan',
        missionId: 'defi-liquidity-scan',
        enabled: true,
        dueDecision: 'due',
        cadenceDescription: 'every 6 hour(s)',
        currentSlotId: 'interval_hours:6:2026-03-10T18:00Z'
      }]
    };

    const first = scheduler.advanceForSchedulerTick(input);
    const second = scheduler.advanceForSchedulerTick(input);

    expect(first.advancedInvestigations).toEqual([started.record.investigationRunId]);
    expect(second.advancedInvestigations).toEqual([]);

    const events = JSON.parse(fs.readFileSync(path.join(investigationsRoot, '2026-03-10', 'investigation-events.json'), 'utf8')) as Array<Record<string, unknown>>;
    const slotEvents = events.filter((event) => (
      event.eventType === 'PHASE_SLOT_ADVANCEMENT_RECORDED'
      && event.phaseId === 'analyze'
      && event.schedulerSlot === 'interval_hours:6:2026-03-10T18:00Z'
    ));

    expect(slotEvents).toHaveLength(1);
  });
});
