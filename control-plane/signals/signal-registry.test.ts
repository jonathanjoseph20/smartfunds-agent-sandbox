import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalRegistry } from './signal-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-signals-registry');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('signal registry', () => {
  it('T-SIG-R1 loads seeded definitions deterministically', () => {
    const registry = createSignalRegistry();
    expect(registry.listSignalTypes()).toEqual([
      'governance_proposal',
      'large_token_unlock',
      'liquidity_drain',
      'protocol_risk',
      'tvl_spike',
      'yield_anomaly'
    ]);
  });

  it('T-SIG-R2 rejects malformed definitions at initialization', () => {
    const defsDir = path.join(tmpRoot, 'definitions');
    writeJson(path.join(defsDir, 'invalid.json'), {
      signalType: 'invalid_signal',
      description: 'invalid',
      sourceMission: 'm',
      schema: {
        dataset: 'string',
        slot: 'string'
      },
      deduplicationRules: ['dataset', 'signalType', 'slot']
    });

    expect(() => createSignalRegistry({ definitionsDir: defsDir })).toThrow('deduplicationRules must equal signalType, dataset, slot');
  });

  it('T-SIG-R3 validates payload required keys and primitive types', () => {
    const registry = createSignalRegistry();

    const valid = registry.validateSignalPayload('tvl_spike', {
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      tvlChangePercent: 12
    });

    expect(valid.protocol).toBe('Aave');
    expect(() => registry.validateSignalPayload('tvl_spike', {
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      tvlChangePercent: '12'
    })).toThrow('must be type number');
  });
});
