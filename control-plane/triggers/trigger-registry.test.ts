import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTriggerRegistry } from './trigger-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-triggers-registry');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('trigger registry', () => {
  it('T-TRIG-R1 loads seeded definitions in deterministic triggerId order', () => {
    const registry = createTriggerRegistry();

    expect(registry.listTriggers().map((entry) => entry.triggerId)).toEqual([
      'governance-proposal-investigation',
      'large-token-unlock-investigation',
      'liquidity-drain-investigation',
      'protocol-risk-investigation',
      'tvl-spike-investigation',
      'yield-anomaly-investigation'
    ]);
  });

  it('T-TRIG-R2 rejects malformed definitions', () => {
    const defsDir = path.join(tmpRoot, 'definitions');
    writeJson(path.join(defsDir, 'invalid.json'), {
      triggerId: 'invalid',
      signalType: 'liquidity_drain',
      mission: 'defi-liquidity-scan',
      cooldownSlots: -1
    });

    expect(() => createTriggerRegistry({ definitionsDir: defsDir })).toThrow('cooldownSlots must be a non-negative integer');
  });

  it('T-TRIG-R3 getTriggersForSignal returns deterministic subset', () => {
    const defsDir = path.join(tmpRoot, 'definitions');
    writeJson(path.join(defsDir, 'b.json'), {
      triggerId: 'z-trigger',
      signalType: 'tvl_spike',
      mission: 'defi-liquidity-scan',
      cooldownSlots: 1
    });
    writeJson(path.join(defsDir, 'a.json'), {
      triggerId: 'a-trigger',
      signalType: 'tvl_spike',
      mission: 'defi-liquidity-scan',
      cooldownSlots: 1
    });
    writeJson(path.join(defsDir, 'c.json'), {
      triggerId: 'other-trigger',
      signalType: 'yield_anomaly',
      mission: 'defi-yield-report',
      cooldownSlots: 1
    });

    const registry = createTriggerRegistry({ definitionsDir: defsDir });
    expect(registry.getTriggersForSignal('tvl_spike').map((entry) => entry.triggerId)).toEqual([
      'a-trigger',
      'z-trigger'
    ]);
  });
});
