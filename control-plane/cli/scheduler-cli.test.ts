import { describe, expect, it, vi } from 'vitest';

import { main as historyMain } from './schedules-history.ts';
import { main as inspectMain } from './schedules-inspect.ts';
import { main as listMain } from './schedules-list.ts';
import { main as tickMain } from './scheduler-tick.ts';

const listSchedules = vi.fn(() => []);
const inspectSchedule = vi.fn(() => ({ scheduleId: 'alpha' }));
const listHistory = vi.fn(() => []);
const tick = vi.fn(async () => ({ tickTimeUtc: '2026-03-10T13:00:00.000Z', evaluations: [], launches: [] }));

vi.mock('../scheduler/service.ts', () => ({
  createSchedulerService: vi.fn(() => ({
    listSchedules,
    inspectSchedule,
    listHistory,
    tick
  }))
}));

describe('scheduler CLI commands', () => {
  it('T-CLI1 schedules:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(listSchedules).toHaveBeenCalledTimes(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('[]');
    stdout.mockRestore();
  });

  it('T-CLI2 schedules:inspect requires --schedule', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --schedule');
    stdout.mockRestore();
  });

  it('T-CLI3 schedules:history routes args', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--schedule', 'alpha', '--limit', '5']);

    expect(code).toBe(0);
    expect(listHistory).toHaveBeenLastCalledWith({ scheduleId: 'alpha', limit: 5 });
    stdout.mockRestore();
  });

  it('T-CLI4 scheduler:tick supports dry-run', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await tickMain(['--dry-run']);

    expect(code).toBe(0);
    expect(tick).toHaveBeenLastCalledWith({ dryRun: true });
    stdout.mockRestore();
  });
});
