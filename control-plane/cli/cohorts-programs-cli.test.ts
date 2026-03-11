import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as programsMain } from './cohorts-programs.ts';
import { main as statusMain } from './cohorts-program-status.ts';
import { main as historyMain } from './cohorts-program-history.ts';
import { main as runMain } from './cohorts-program-run.ts';

const {
  listCohortPrograms,
  inspectCohortProgramStatus,
  inspectCohortProgramHistory,
  runCohortProgram,
  materializeCohortPrograms
} = vi.hoisted(() => ({
  listCohortPrograms: vi.fn(() => [{ programId: 'aave-risk-monitor', cohortId: 'aave-risk' }]),
  inspectCohortProgramStatus: vi.fn(() => ({ cohortId: 'aave-risk', cohortLifecycleState: 'monitoring', programs: [] })),
  inspectCohortProgramHistory: vi.fn(() => ([{ cohortId: 'aave-risk', programId: 'aave-risk-monitor', entries: [] }])),
  runCohortProgram: vi.fn(() => ({ cohortId: 'aave-risk', programId: 'aave-risk-monitor', launches: [] })),
  materializeCohortPrograms: vi.fn(() => ([{ cohortId: 'aave-risk', programId: 'aave-risk-monitor' }]))
}));

vi.mock('../cohorts/cohort-inspection.ts', () => ({
  createCohortInspection: vi.fn(() => ({
    listCohortPrograms,
    inspectCohortProgramStatus,
    inspectCohortProgramHistory,
    runCohortProgram
  }))
}));

vi.mock('../cohorts/programs/program-materializer.ts', () => ({
  createCohortProgramMaterializer: vi.fn(() => ({
    materializeCohortPrograms
  }))
}));

describe('cohort programs CLI commands', () => {
  it('T-CP-CLI1 cohorts:programs returns deterministic list for cohort', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await programsMain(['--cohort', 'aave-risk']);

    expect(code).toBe(0);
    expect(listCohortPrograms).toHaveBeenCalledWith('aave-risk');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listCohortPrograms())}\n`);
    stdout.mockRestore();
  });

  it('T-CP-CLI2 cohorts:program-status requires --cohort', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --cohort');
    stdout.mockRestore();
  });

  it('T-CP-CLI3 cohorts:program-history routes arguments', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--cohort=aave-risk']);

    expect(code).toBe(0);
    expect(inspectCohortProgramHistory).toHaveBeenCalledWith('aave-risk');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectCohortProgramHistory())}\n`);
    stdout.mockRestore();
  });

  it('T-CP-CLI4 cohorts:program-run evaluates and materializes deterministically', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await runMain(['--program', 'aave-risk-monitor', '--slot', 'daily:2026-03-11']);

    expect(code).toBe(0);
    expect(runCohortProgram).toHaveBeenCalledWith('aave-risk-monitor', 'daily:2026-03-11');
    expect(materializeCohortPrograms).toHaveBeenCalledWith({
      cohortId: 'aave-risk',
      slot: 'daily:2026-03-11'
    });
    stdout.mockRestore();
  });
});
