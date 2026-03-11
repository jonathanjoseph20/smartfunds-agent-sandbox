import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalStore } from '../../signals/signal-store.ts';

import { createProgramAutomationEvaluator } from './program-automation-evaluator.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-program-automation');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedProgramDefinition(defsDir: string, value: Record<string, unknown>): void {
  writeJson(path.join(defsDir, `${String(value.programId)}.json`), value);
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('program automation evaluator', () => {
  it('T-CPA-1 evaluates cadence due and dedupes repeated same-slot evaluations', () => {
    const scope = 'cadence';
    const root = path.join(tmpRoot, scope);
    const defsDir = path.join(root, 'program-defs');

    seedProgramDefinition(defsDir, {
      programId: 'aave-risk-monitor',
      cohortId: 'aave-risk',
      displayName: 'Aave Risk Monitor',
      cadence: 'daily',
      enabled: true,
      lifecycleState: 'active',
      investigationTemplates: ['protocol-risk-investigation'],
      launchConditions: [{ kind: 'cadence' }]
    });

    const evaluator = createProgramAutomationEvaluator({
      cohortProgramDefinitionsDir: defsDir,
      cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts'),
      investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations'),
      investigationsRootDir: path.join(root, 'investigations'),
      signalsRootDir: path.join(root, 'signals'),
      now: () => new Date('2026-03-11T12:00:00.000Z')
    });

    const first = evaluator.evaluateProgram({
      programId: 'aave-risk-monitor',
      slot: 'daily:2026-03-11'
    });
    const second = evaluator.evaluateProgram({
      programId: 'aave-risk-monitor',
      slot: 'daily:2026-03-11'
    });

    expect(first.status.evaluationState === 'launched' || first.status.evaluationState === 'suppressed').toBe(true);
    expect(second.status.evaluationState).toBe('deduped');
  });

  it('T-CPA-2 detects signal-driven eligibility with stable reason ordering', () => {
    const scope = 'signal';
    const root = path.join(tmpRoot, scope);
    const defsDir = path.join(root, 'program-defs');

    seedProgramDefinition(defsDir, {
      programId: 'yield-anomaly-monitor',
      cohortId: 'aave-yield',
      displayName: 'Yield Anomaly Monitor',
      cadence: 'signal_driven',
      enabled: true,
      lifecycleState: 'active',
      investigationTemplates: ['yield-anomaly-investigation'],
      launchConditions: [{ kind: 'signal_type', signalType: 'yield_anomaly' }]
    });

    const signalStore = createSignalStore({ rootDir: path.join(root, 'signals') });
    signalStore.appendSignal({
      signalType: 'yield_anomaly',
      sourceMission: 'defi-yield-report',
      dataset: 'yield_rate_history',
      metadata: { protocol: 'Aave', yieldChangePercent: 8 },
      slot: 'daily:2026-03-11',
      dedupeKey: 'sig-yield-1',
      logDate: '2026-03-11'
    });

    const evaluator = createProgramAutomationEvaluator({
      cohortProgramDefinitionsDir: defsDir,
      cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts'),
      investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations'),
      investigationsRootDir: path.join(root, 'investigations'),
      signalsRootDir: path.join(root, 'signals'),
      now: () => new Date('2026-03-11T12:00:00.000Z')
    });

    const projected = evaluator.evaluateProgram({
      programId: 'yield-anomaly-monitor',
      slot: 'daily:2026-03-11',
      execute: false,
      persistHistory: false
    });

    expect(projected.status.evaluationState).toBe('signal_match');
    expect(projected.status.triggeringConditionTypes).toEqual(['signal_type']);
    expect(projected.status.triggerReasons).toEqual(['signal_match:yield_anomaly']);
  });
});
