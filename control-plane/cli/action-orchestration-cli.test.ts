import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './action-orchestration-history.ts';
import { main as inspectMain } from './action-orchestration-inspect.ts';
import { main as linksMain } from './action-orchestration-links.ts';
import { main as listMain } from './action-orchestration-list.ts';
import { main as materializeMain } from './action-orchestration-materialize.ts';
import { main as priorityMain } from './action-orchestration-priority.ts';
import { main as readinessMain } from './action-orchestration-readiness.ts';
import { main as statusMain } from './action-orchestration-status.ts';

const {
  listPlans,
  inspectPlan,
  getPlanStatus,
  getPlanLinks,
  getPlanReadiness,
  getPlanPriority,
  getPlanHistory,
  materializeOne,
} = vi.hoisted(() => ({
  listPlans: vi.fn(() => [{ actionPlanId: 'risk-reduction-plan', displayName: 'Risk Reduction Plan', planType: 'risk_reduction', enabled: true }]),
  inspectPlan: vi.fn(() => ({ actionPlanId: 'risk-reduction-plan', lifecycleState: 'progressing' })),
  getPlanStatus: vi.fn(() => ({ actionPlanId: 'risk-reduction-plan', lifecycleState: 'progressing', readinessState: 'analyzing', completionState: 'incomplete', priority: 'normal', routeSummary: 'review_bundle' })),
  getPlanLinks: vi.fn(() => ({ actionPlanId: 'risk-reduction-plan', linkedActionIds: ['reduce-risk-exposure'] })),
  getPlanReadiness: vi.fn(() => ({ actionPlanId: 'risk-reduction-plan', readinessState: 'analyzing' })),
  getPlanPriority: vi.fn(() => ({ actionPlanId: 'risk-reduction-plan', priority: 'normal', routeSummary: 'review_bundle' })),
  getPlanHistory: vi.fn(() => ({ actionPlanId: 'risk-reduction-plan', entries: [] })),
  materializeOne: vi.fn(() => ({ actionPlanId: 'risk-reduction-plan', statusPath: 'a', historyPath: 'b', reportPath: 'c', markdownPath: 'd' })),
}));

vi.mock('../action-orchestration/action-plan-inspection.ts', () => ({
  createActionPlanInspection: vi.fn(() => ({
    listPlans,
    inspectPlan,
    getPlanStatus,
    getPlanLinks,
    getPlanReadiness,
    getPlanPriority,
    getPlanHistory,
  })),
}));

vi.mock('../action-orchestration/action-plan-materializer.ts', () => ({
  createActionPlanMaterializer: vi.fn(() => ({
    materializeOne,
  })),
}));

describe('action-orchestration CLI commands', () => {
  it('T-AO-CLI1 action-orchestration:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listPlans())}\n`);
    stdout.mockRestore();
  });

  it('T-AO-CLI2 action-orchestration:inspect requires --plan', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --plan');
    stdout.mockRestore();
  });

  it('T-AO-CLI3 action-orchestration:status routes --plan', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--plan', 'risk-reduction-plan']);

    expect(code).toBe(0);
    expect(getPlanStatus).toHaveBeenCalledWith('risk-reduction-plan');
    stdout.mockRestore();
  });

  it('T-AO-CLI4 action-orchestration:links routes --plan', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await linksMain(['--plan=risk-reduction-plan']);

    expect(code).toBe(0);
    expect(getPlanLinks).toHaveBeenCalledWith('risk-reduction-plan');
    stdout.mockRestore();
  });

  it('T-AO-CLI5 action-orchestration:readiness routes --plan', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await readinessMain(['--plan', 'risk-reduction-plan']);

    expect(code).toBe(0);
    expect(getPlanReadiness).toHaveBeenCalledWith('risk-reduction-plan');
    stdout.mockRestore();
  });

  it('T-AO-CLI6 action-orchestration:priority routes --plan', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await priorityMain(['--plan', 'risk-reduction-plan']);

    expect(code).toBe(0);
    expect(getPlanPriority).toHaveBeenCalledWith('risk-reduction-plan');
    stdout.mockRestore();
  });

  it('T-AO-CLI7 action-orchestration:history routes --plan', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--plan', 'risk-reduction-plan']);

    expect(code).toBe(0);
    expect(getPlanHistory).toHaveBeenCalledWith('risk-reduction-plan');
    stdout.mockRestore();
  });

  it('T-AO-CLI8 action-orchestration:materialize routes --plan', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--plan', 'risk-reduction-plan']);

    expect(code).toBe(0);
    expect(materializeOne).toHaveBeenCalledWith('risk-reduction-plan');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeOne())}\n`);
    stdout.mockRestore();
  });
});
