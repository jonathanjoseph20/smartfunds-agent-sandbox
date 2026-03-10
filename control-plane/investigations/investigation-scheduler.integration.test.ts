import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createInvestigationExecutor } from './investigation-executor.ts';
import { createInvestigationScheduler } from './investigation-scheduler.ts';
import { createSignalStore } from '../signals/signal-store.ts';
import { createSignalEmitter } from '../signals/signal-emitter.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigation-scheduler-integration');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeDefinition(filePath: string, options: {
  executionModeByPhase?: Partial<Record<'intake' | 'gather' | 'analyze' | 'synthesize' | 'finalize', 'immediate' | 'next_tick' | 'delayed'>>;
  minDelaySlotsByPhase?: Partial<Record<'intake' | 'gather' | 'analyze' | 'synthesize' | 'finalize', number>>;
  waitConditionByPhase?: Partial<Record<'intake' | 'gather' | 'analyze' | 'synthesize' | 'finalize', 'new_dataset_observation' | 'fixed_slot_delay'>>;
  retryByPhase?: Partial<Record<'intake' | 'gather' | 'analyze' | 'synthesize' | 'finalize', { policy: 'never' | 'bounded'; maxRetries: number }>>;
} = {}): void {
  const phases = ['intake', 'gather', 'analyze', 'synthesize', 'finalize'] as const;

  writeJson(filePath, {
    investigationDefinitionId: 'liquidity-drain-investigation',
    sourceSignalType: 'liquidity_drain',
    sourceTriggerId: 'liquidity-drain-investigation',
    phases: phases.map((phaseId) => ({
      phaseId,
      kind: phaseId,
      requiredInputs: [],
      produces: [phaseId],
      ...(options.executionModeByPhase?.[phaseId] ? { executionMode: options.executionModeByPhase[phaseId] } : {}),
      ...(options.minDelaySlotsByPhase?.[phaseId] !== undefined ? { minDelaySlots: options.minDelaySlotsByPhase[phaseId] } : {}),
      ...(options.waitConditionByPhase?.[phaseId] ? { waitCondition: options.waitConditionByPhase[phaseId] } : {}),
      ...(options.retryByPhase?.[phaseId]
        ? {
          retryPolicy: options.retryByPhase[phaseId]?.policy,
          maxRetries: options.retryByPhase[phaseId]?.maxRetries
        }
        : {})
    })),
    outputArtifacts: [
      'investigation-report.json',
      'investigation-report.md'
    ],
    completionCriteria: [
      'all_phases_completed',
      'final_report_written'
    ],
    dedupeStrategy: 'definition_signal_slot'
  });
}

function setupSignal(signalStoreRoot: string, slot = 'interval_hours:6:2026-03-10T12:00Z', dedupeKey = 'signal-key'): void {
  const signalStore = createSignalStore({ rootDir: signalStoreRoot });
  signalStore.appendSignal({
    signalType: 'liquidity_drain',
    sourceMission: 'defi-liquidity-scan',
    dataset: 'protocol_tvl_timeseries',
    metadata: { protocol: 'Aave', liquidityDropPercent: 12 },
    slot,
    dedupeKey,
    logDate: '2026-03-10'
  });
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('investigation scheduler integration', () => {
  it('T-INV-SCH-INT1 multi-cycle happy path pauses then resumes and generates final report', () => {
    const defsDir = path.join(tmpRoot, 'defs-1');
    writeDefinition(path.join(defsDir, 'liquidity.json'), {
      executionModeByPhase: { analyze: 'next_tick' },
      minDelaySlotsByPhase: { analyze: 1 }
    });

    const signalsRoot = path.join(tmpRoot, 'signals-1');
    const investigationsRoot = path.join(tmpRoot, 'investigations-1');
    const artifactsRoot = path.join(tmpRoot, 'artifacts-1', 'investigations');

    setupSignal(signalsRoot);

    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir: signalsRoot,
      investigationsRootDir: investigationsRoot,
      investigationArtifactsRoot: artifactsRoot
    });

    const started = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key'
    });

    expect(started.record.status).toBe('scheduled_resume');

    const scheduler = createInvestigationScheduler({ executor });
    const advanced = scheduler.advanceForSchedulerTick({
      tickTimeUtc: '2026-03-10T18:01:00.000Z',
      evaluations: [{
        scheduleId: 'defi-liquidity-hourly-scan',
        missionId: 'defi-liquidity-scan',
        enabled: true,
        dueDecision: 'due',
        cadenceDescription: 'every 6 hour(s)',
        currentSlotId: 'interval_hours:6:2026-03-10T18:00Z'
      }]
    });

    expect(advanced.advancedInvestigations).toEqual([started.record.investigationRunId]);
    expect(executor.getInvestigation(started.record.investigationRunId).status).toBe('completed');
    expect(fs.existsSync(path.join(artifactsRoot, started.record.investigationRunId, 'investigation-report.md'))).toBe(true);
  });

  it('T-INV-SCH-INT2 retryable phase failure is retried on later slot and then succeeds', () => {
    const defsDir = path.join(tmpRoot, 'defs-2');
    writeDefinition(path.join(defsDir, 'liquidity.json'), {
      retryByPhase: {
        gather: { policy: 'bounded', maxRetries: 2 }
      }
    });

    const signalsRoot = path.join(tmpRoot, 'signals-2');
    const investigationsRoot = path.join(tmpRoot, 'investigations-2');
    setupSignal(signalsRoot);

    let gatherAttempts = 0;
    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir: signalsRoot,
      investigationsRootDir: investigationsRoot,
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts-2', 'investigations'),
      phaseExecutor(input) {
        if (input.phase.phaseId === 'gather') {
          gatherAttempts += 1;
          if (gatherAttempts === 1) {
            throw new Error('transient_gather_failure');
          }
        }
        return { artifacts: [], findings: [`phase:${input.phase.phaseId}`] };
      }
    });

    const started = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key'
    });
    expect(started.record.status).toBe('retry_pending');

    const resumed = executor.advanceDueInvestigations({ schedulerSlot: 'interval_hours:6:2026-03-10T18:00Z' });
    expect(resumed.advancedInvestigations).toEqual([started.record.investigationRunId]);
    expect(executor.getInvestigation(started.record.investigationRunId).status).toBe('completed');
  });

  it('T-INV-SCH-INT3 awaiting_data remains waiting until deterministic signal condition changes', () => {
    const defsDir = path.join(tmpRoot, 'defs-3');
    writeDefinition(path.join(defsDir, 'liquidity.json'), {
      waitConditionByPhase: { gather: 'new_dataset_observation' }
    });

    const signalsRoot = path.join(tmpRoot, 'signals-3');
    const investigationsRoot = path.join(tmpRoot, 'investigations-3');
    setupSignal(signalsRoot);

    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir: signalsRoot,
      investigationsRootDir: investigationsRoot,
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts-3', 'investigations')
    });

    const started = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key'
    });

    expect(started.record.status).toBe('awaiting_data');

    const stillWaiting = executor.advanceDueInvestigations({ schedulerSlot: 'interval_hours:6:2026-03-10T18:00Z' });
    expect(stillWaiting.advancedInvestigations).toEqual([]);

    setupSignal(signalsRoot, 'interval_hours:6:2026-03-10T18:00Z', 'signal-key-new');
    const resumed = executor.advanceDueInvestigations({ schedulerSlot: 'interval_hours:6:2026-03-10T18:00Z' });
    expect(resumed.advancedInvestigations).toEqual([started.record.investigationRunId]);
    expect(executor.getInvestigation(started.record.investigationRunId).status).toBe('completed');
  });

  it('T-INV-SCH-INT4 regression path keeps immediate single-pass investigations working', () => {
    const defsDir = path.join(tmpRoot, 'defs-4');
    writeDefinition(path.join(defsDir, 'liquidity.json'));

    const signalsRoot = path.join(tmpRoot, 'signals-4');
    const investigationsRoot = path.join(tmpRoot, 'investigations-4');
    setupSignal(signalsRoot);

    const executor = createInvestigationExecutor({
      definitionsDir: defsDir,
      signalsRootDir: signalsRoot,
      investigationsRootDir: investigationsRoot,
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts-4', 'investigations')
    });

    const started = executor.executeLaunchRequest({
      missionId: 'defi-liquidity-scan',
      triggerId: 'liquidity-drain-investigation',
      sourceSignal: 'signal-key'
    });

    expect(started.status).toBe('started');
    expect(started.record.status).toBe('completed');
  });

  it('T-INV-SCH-INT5 signal/trigger compatibility remains intact with lifecycle scheduling enabled', () => {
    const defsDir = path.join(tmpRoot, 'defs-5');
    writeDefinition(path.join(defsDir, 'liquidity.json'), {
      executionModeByPhase: { analyze: 'next_tick' },
      minDelaySlotsByPhase: { analyze: 1 }
    });

    const emitter = createSignalEmitter({
      investigationDefinitionsDir: defsDir,
      signalsRootDir: path.join(tmpRoot, 'signals-5'),
      triggersRootDir: path.join(tmpRoot, 'triggers-5'),
      investigationsRootDir: path.join(tmpRoot, 'investigations-5'),
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts-5', 'investigations')
    });

    const result = emitter.emitSignal('liquidity_drain', {
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      liquidityDropPercent: 12
    });

    expect(result.status).toBe('persisted');
    expect(fs.existsSync(path.join(tmpRoot, 'signals-5', '2026-03-10', 'signal-log.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, 'triggers-5', '2026-03-10', 'trigger-log.json'))).toBe(true);
    const history = JSON.parse(fs.readFileSync(path.join(tmpRoot, 'investigations-5', '2026-03-10', 'investigation-events.json'), 'utf8')) as Array<{ eventType: string }>;
    expect(history.some((entry) => entry.eventType === 'PHASE_SCHEDULED_RESUME')).toBe(true);
  });
});
