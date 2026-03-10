import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createResearchRuntime } from './runtime.ts';
import type { SignalEmitter } from '../signals/signal-emitter.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-research-signal-regression');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('research runtime signal regression guard', () => {
  it('T-SIG-RG1 runtime launch outcome remains unchanged when signal emission fails', () => {
    const artifactsRoot = path.join(tmpRoot, 'artifacts');
    const teamsDir = path.join(tmpRoot, 'teams');
    const packsDir = path.join(tmpRoot, 'packs');
    const scheduleRegistryPath = path.join(tmpRoot, 'scheduler-registry.json');

    writeJson(path.join(teamsDir, 'defi-intelligence.json'), {
      teamId: 'defi-intelligence',
      missionPackId: 'defi-intelligence',
      description: 'team',
      enabled: true
    });

    writeJson(path.join(packsDir, 'defi-intelligence.json'), {
      packId: 'defi-intelligence',
      teamId: 'defi-intelligence',
      schedules: ['defi-yield-hourly-scan']
    });

    writeJson(scheduleRegistryPath, {
      schemaVersion: 1,
      schedules: [
        { scheduleId: 'defi-yield-hourly-scan', missionId: 'defi-yield-report', enabled: true, cadence: { type: 'interval_hours', every: 6 } }
      ]
    });

    writeJson(path.join(artifactsRoot, 'defi-yield-report', 'run_1', 'yield-report-json.json'), {
      entries: [{ protocol: 'Aave', yieldChangePercent: 7 }]
    });

    const runtime = createResearchRuntime({
      artifactsRoot,
      teamsDir,
      packsDir,
      scheduleRegistryPath,
      signalEmitter: {
        emitSignal() {
          throw new Error('forced_failure');
        }
      } as unknown as SignalEmitter
    });

    const outcomes = runtime.processLaunch({
      scheduleId: 'defi-yield-hourly-scan',
      missionId: 'defi-yield-report',
      slotId: 'interval_hours:6:2026-03-10T12:00Z',
      dueDecision: 'due',
      launched: true,
      runId: 'run_1',
      attemptedAtUtc: '2026-03-10T12:01:00.000Z'
    });

    expect(outcomes).toHaveLength(1);
    expect(Object.keys(outcomes[0]).sort((a, b) => a.localeCompare(b))).toEqual([
      'launchKey',
      'packId',
      'processed',
      'scheduleId',
      'summaryGenerated',
      'teamId',
      'updatedDatasets'
    ]);
    expect(outcomes[0].processed).toBe(true);
    expect(outcomes[0].summaryGenerated).toBe(false);
  });
});
