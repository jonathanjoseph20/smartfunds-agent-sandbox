import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createResearchRuntime } from '../research/runtime.ts';
import type { TriggerEngine } from '../triggers/trigger-engine.ts';
import { createSignalEmitter, type SignalEmitter } from './signal-emitter.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-research-trigger-regression');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('research runtime trigger regression guard', () => {
  it('T-TRIG-RG1 runtime launch outcome remains unchanged when trigger evaluation fails', () => {
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
      schedules: ['defi-liquidity-hourly-scan']
    });

    writeJson(scheduleRegistryPath, {
      schemaVersion: 1,
      schedules: [
        { scheduleId: 'defi-liquidity-hourly-scan', missionId: 'defi-liquidity-scan', enabled: true, cadence: { type: 'interval_hours', every: 6 } }
      ]
    });

    writeJson(path.join(artifactsRoot, 'defi-liquidity-scan', 'run_1', 'liquidity-snapshot-json.json'), {
      entries: [{ protocol: 'Aave', tvlChangePercent: 12 }]
    });

    const signalEmitter = createSignalEmitter({
      signalsRootDir: path.join(tmpRoot, 'signals'),
      triggersRootDir: path.join(tmpRoot, 'triggers'),
      triggerEngine: {
        evaluateSignalForTriggers() {
          throw new Error('forced_trigger_failure');
        }
      } as unknown as TriggerEngine
    });

    const runtime = createResearchRuntime({
      artifactsRoot,
      teamsDir,
      packsDir,
      scheduleRegistryPath,
      signalEmitter: signalEmitter as SignalEmitter
    });

    const outcomes = runtime.processLaunch({
      scheduleId: 'defi-liquidity-hourly-scan',
      missionId: 'defi-liquidity-scan',
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

    const signalLogPath = path.join(tmpRoot, 'signals', '2026-03-10', 'signal-log.json');
    expect(fs.existsSync(signalLogPath)).toBe(true);
  });
});
