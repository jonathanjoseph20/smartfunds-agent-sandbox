import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './signals-history.ts';
import { main as inspectMain } from './signals-inspect.ts';
import { main as listMain } from './signals-list.ts';

const { listRecent, inspectSignalType, historyByDate } = vi.hoisted(() => ({
  listRecent: vi.fn(() => [{ signalType: 'tvl_spike', sourceMission: 'liquidity-scan', dataset: 'protocol_tvl_timeseries', slot: 'interval_hours:6:2026-03-10T12:00Z', logDate: '2026-03-10' }]),
  inspectSignalType: vi.fn(() => [{ signalType: 'tvl_spike', metadata: { protocol: 'Aave' } }]),
  historyByDate: vi.fn(() => [{ date: '2026-03-10', signals: [] }])
}));

vi.mock('../signals/signal-inspection.ts', () => ({
  createSignalInspection: vi.fn(() => ({
    listRecent,
    inspectSignalType,
    historyByDate
  }))
}));

describe('signals CLI commands', () => {
  it('T-SIG-CLI1 signals:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain(['--limit', '5']);

    expect(code).toBe(0);
    expect(listRecent).toHaveBeenLastCalledWith({ limit: 5 });
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listRecent())}\n`);
    stdout.mockRestore();
  });

  it('T-SIG-CLI2 signals:inspect requires signal type argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: <signalType>');
    stdout.mockRestore();
  });

  it('T-SIG-CLI3 signals:inspect routes positional type', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain(['tvl_spike']);

    expect(code).toBe(0);
    expect(inspectSignalType).toHaveBeenLastCalledWith('tvl_spike');
    stdout.mockRestore();
  });

  it('T-SIG-CLI4 signals:history prints grouped history', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain([]);

    expect(code).toBe(0);
    expect(historyByDate).toHaveBeenCalledTimes(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(historyByDate())}\n`);
    stdout.mockRestore();
  });
});
