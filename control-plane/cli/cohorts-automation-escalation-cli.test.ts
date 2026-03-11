import { describe, expect, it, vi } from 'vitest';

import { main as automationStatusMain } from './cohorts-automation-status.ts';
import { main as escalationMain } from './cohorts-escalation.ts';
import { main as escalationHistoryMain } from './cohorts-escalation-history.ts';
import { main as programEvaluateMain } from './cohorts-program-evaluate.ts';

const {
  inspectCohortAutomationStatus,
  inspectCohortEscalation,
  evaluateCohortEscalation,
  inspectCohortEscalationHistory,
  evaluateCohortPrograms
} = vi.hoisted(() => ({
  inspectCohortAutomationStatus: vi.fn(() => [{ cohortId: 'aave-risk', programId: 'aave-risk-monitor' }]),
  inspectCohortEscalation: vi.fn(() => ({ cohortId: 'aave-risk', escalationState: 'elevated' })),
  evaluateCohortEscalation: vi.fn(() => ({ projection: { cohortId: 'aave-risk', escalationState: 'elevated' }, historyAppended: true })),
  inspectCohortEscalationHistory: vi.fn(() => ({ cohortId: 'aave-risk', entries: [] })),
  evaluateCohortPrograms: vi.fn(() => [{ status: { cohortId: 'aave-risk', programId: 'aave-risk-monitor', evaluationState: 'due' } }])
}));

vi.mock('../cohorts/cohort-inspection.ts', () => ({
  createCohortInspection: vi.fn(() => ({
    inspectCohortAutomationStatus,
    inspectCohortEscalation,
    evaluateCohortEscalation,
    inspectCohortEscalationHistory,
    evaluateCohortPrograms
  }))
}));

describe('cohort automation and escalation CLI commands', () => {
  it('T-CP-AUTO-CLI1 cohorts:program-evaluate requires --slot', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await programEvaluateMain(['--cohort', 'aave-risk']);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --slot');
    stdout.mockRestore();
  });

  it('T-CP-AUTO-CLI2 cohorts:automation-status routes cohort and slot', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await automationStatusMain(['--cohort', 'aave-risk', '--slot', 'daily:2026-03-11']);

    expect(code).toBe(0);
    expect(inspectCohortAutomationStatus).toHaveBeenCalledWith({ cohortId: 'aave-risk', slot: 'daily:2026-03-11' });
    stdout.mockRestore();
  });

  it('T-CP-AUTO-CLI3 cohorts:escalation supports inspect and evaluate modes', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const inspectCode = await escalationMain(['--cohort', 'aave-risk', '--slot', 'daily:2026-03-11']);
    const evaluateCode = await escalationMain(['--cohort', 'aave-risk', '--slot', 'daily:2026-03-11', '--evaluate']);

    expect(inspectCode).toBe(0);
    expect(evaluateCode).toBe(0);
    expect(inspectCohortEscalation).toHaveBeenCalled();
    expect(evaluateCohortEscalation).toHaveBeenCalled();
    stdout.mockRestore();
  });

  it('T-CP-AUTO-CLI4 cohorts:escalation-history requires --cohort', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await escalationHistoryMain(['--cohort', 'aave-risk']);

    expect(code).toBe(0);
    expect(inspectCohortEscalationHistory).toHaveBeenCalledWith('aave-risk');
    stdout.mockRestore();
  });
});
