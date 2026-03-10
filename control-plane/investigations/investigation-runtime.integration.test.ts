import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalEmitter } from '../signals/signal-emitter.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigations-runtime');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('investigation runtime integration', () => {
  it('T-INV-INT1 signal emission triggers a bounded investigation and final report', () => {
    const emitter = createSignalEmitter({
      signalsRootDir: path.join(tmpRoot, 'signals'),
      triggersRootDir: path.join(tmpRoot, 'triggers'),
      investigationsRootDir: path.join(tmpRoot, 'investigations'),
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts', 'investigations')
    });

    const result = emitter.emitSignal('liquidity_drain', {
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      liquidityDropPercent: 12
    });

    expect(result.status).toBe('persisted');

    const investigationsHistory = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, 'investigations', '2026-03-10', 'investigation-events.json'), 'utf8')
    ) as Array<Record<string, unknown>>;

    expect(investigationsHistory.some((entry) => entry.eventType === 'INVESTIGATION_COMPLETED')).toBe(true);
    const reportPath = path.join(tmpRoot, 'artifacts', 'investigations');
    const runDir = fs.readdirSync(reportPath).sort((left, right) => left.localeCompare(right))[0];
    expect(fs.existsSync(path.join(reportPath, runDir, 'investigation-report.md'))).toBe(true);
  });

  it('T-INV-INT2 duplicate trigger condition does not create a second investigation', () => {
    const emitter = createSignalEmitter({
      signalsRootDir: path.join(tmpRoot, 'signals'),
      triggersRootDir: path.join(tmpRoot, 'triggers'),
      investigationsRootDir: path.join(tmpRoot, 'investigations'),
      investigationArtifactsRoot: path.join(tmpRoot, 'artifacts', 'investigations')
    });

    emitter.emitSignal('yield_anomaly', {
      dataset: 'yield_rate_history',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Morpho',
      yieldChangePercent: 8
    });
    emitter.emitSignal('yield_anomaly', {
      dataset: 'yield_rate_history',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Morpho',
      yieldChangePercent: 8
    });

    const investigationsHistory = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, 'investigations', '2026-03-10', 'investigation-events.json'), 'utf8')
    ) as Array<Record<string, unknown>>;

    expect(investigationsHistory.filter((entry) => entry.eventType === 'INVESTIGATION_CREATED')).toHaveLength(1);
  });
});
