import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './investigations-history.ts';
import { main as dueMain } from './investigations-due.ts';
import { main as inspectMain } from './investigations-inspect.ts';
import { main as listMain } from './investigations-list.ts';
import { main as reportMain } from './investigations-report.ts';

const { listInvestigations, inspectInvestigation, historyByDate, readReport } = vi.hoisted(() => ({
  listInvestigations: vi.fn(() => [{ investigationRunId: 'run-1', status: 'completed' }]),
  inspectInvestigation: vi.fn(() => ({ record: { investigationRunId: 'run-1' }, definition: {}, history: [] })),
  historyByDate: vi.fn(() => [{ date: '2026-03-10', investigations: [] }]),
  readReport: vi.fn(() => ({ reportPath: 'artifacts/investigations/run-1/investigation-report.md', content: '# Investigation Report\n' }))
}));
const { listDueInvestigations } = vi.hoisted(() => ({
  listDueInvestigations: vi.fn(() => [{ investigationRunId: 'run-1', dueNow: true, dueReason: 'due' }])
}));

vi.mock('../investigations/investigation-inspection.ts', () => ({
  createInvestigationInspection: vi.fn(() => ({
    listInvestigations,
    inspectInvestigation,
    historyByDate,
    readReport
  }))
}));

vi.mock('../investigations/investigation-scheduler.ts', () => ({
  createInvestigationScheduler: vi.fn(() => ({
    listDueInvestigations
  }))
}));

describe('investigations CLI commands', () => {
  it('T-INV-CLI1 investigations:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listInvestigations())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI2 investigations:inspect requires --investigation', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --investigation');
    stdout.mockRestore();
  });

  it('T-INV-CLI3 investigations:inspect routes flag argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(inspectInvestigation).toHaveBeenCalledWith('run-1');
    stdout.mockRestore();
  });

  it('T-INV-CLI4 investigations:history prints grouped history', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(historyByDate())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI6 investigations:history supports --investigation filter', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(inspectInvestigation).toHaveBeenCalledWith('run-1');
    stdout.mockRestore();
  });

  it('T-INV-CLI5 investigations:report prints report body', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await reportMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith('# Investigation Report\n');
    stdout.mockRestore();
  });

  it('T-INV-CLI7 investigations:due prints deterministic due projection', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await dueMain(['--slot', 'interval_hours:6:2026-03-10T18:00Z']);

    expect(code).toBe(0);
    expect(listDueInvestigations).toHaveBeenCalledWith({ schedulerSlot: 'interval_hours:6:2026-03-10T18:00Z' });
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listDueInvestigations())}\n`);
    stdout.mockRestore();
  });
});
