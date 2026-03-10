import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './triggers-history.ts';
import { main as inspectMain } from './triggers-inspect.ts';
import { main as listMain } from './triggers-list.ts';

const { listTriggers, inspectTrigger, historyByDate } = vi.hoisted(() => ({
  listTriggers: vi.fn(() => [{ triggerId: 'liquidity-drain-investigation', signalType: 'liquidity_drain', mission: 'defi-liquidity-scan', cooldownSlots: 1 }]),
  inspectTrigger: vi.fn(() => ({ triggerId: 'liquidity-drain-investigation', signalType: 'liquidity_drain', mission: 'defi-liquidity-scan', cooldownSlots: 1 })),
  historyByDate: vi.fn(() => [{ date: '2026-03-10', triggers: [] }])
}));

vi.mock('../triggers/trigger-inspection.ts', () => ({
  createTriggerInspection: vi.fn(() => ({
    listTriggers,
    inspectTrigger,
    historyByDate
  }))
}));

describe('triggers CLI commands', () => {
  it('T-TRIG-CLI1 triggers:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(listTriggers).toHaveBeenCalledTimes(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listTriggers())}\n`);
    stdout.mockRestore();
  });

  it('T-TRIG-CLI2 triggers:inspect requires triggerId argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: <triggerId>');
    stdout.mockRestore();
  });

  it('T-TRIG-CLI3 triggers:inspect routes positional triggerId', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain(['liquidity-drain-investigation']);

    expect(code).toBe(0);
    expect(inspectTrigger).toHaveBeenLastCalledWith('liquidity-drain-investigation');
    stdout.mockRestore();
  });

  it('T-TRIG-CLI4 triggers:history prints grouped history', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain([]);

    expect(code).toBe(0);
    expect(historyByDate).toHaveBeenCalledTimes(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(historyByDate())}\n`);
    stdout.mockRestore();
  });
});
