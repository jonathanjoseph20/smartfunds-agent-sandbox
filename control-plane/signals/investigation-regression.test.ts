import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { InvestigationExecutor } from '../investigations/investigation-executor.ts';

import { createSignalEmitter } from './signal-emitter.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigation-regression');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('signal investigation regression guard', () => {
  it('T-INV-RG1 signal and trigger persistence remain intact when investigation startup fails', () => {
    const emitter = createSignalEmitter({
      signalsRootDir: path.join(tmpRoot, 'signals'),
      triggersRootDir: path.join(tmpRoot, 'triggers'),
      investigationExecutor: {
        executeLaunchRequests() {
          throw new Error('forced_investigation_failure');
        }
      } as unknown as InvestigationExecutor
    });

    const result = emitter.emitSignal('liquidity_drain', {
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      liquidityDropPercent: 12
    });

    expect(result.status).toBe('persisted');

    const signalLogPath = path.join(tmpRoot, 'signals', '2026-03-10', 'signal-log.json');
    const triggerLogPath = path.join(tmpRoot, 'triggers', '2026-03-10', 'trigger-log.json');

    expect(fs.existsSync(signalLogPath)).toBe(true);
    expect(fs.existsSync(triggerLogPath)).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, 'investigations'))).toBe(false);
  });
});
