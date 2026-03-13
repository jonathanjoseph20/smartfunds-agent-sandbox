import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as listMain } from '../../cli/mission-control-execution-list.ts';
import { main as inspectMain } from '../../cli/mission-control-execution-inspect.ts';
import { main as intentsMain } from '../../cli/mission-control-execution-intents.ts';
import { main as requestsMain } from '../../cli/mission-control-execution-requests.ts';
import { main as feedbackMain } from '../../cli/mission-control-execution-feedback.ts';
import { main as statusMain } from '../../cli/mission-control-execution-status.ts';
import { main as historyMain } from '../../cli/mission-control-execution-history.ts';
import { main as materializeMain } from '../../cli/mission-control-execution-materialize.ts';
import { main as deferMain } from '../../cli/mission-control-execution-defer.ts';
import { main as markActiveMain } from '../../cli/mission-control-execution-mark-active.ts';
import { main as markCompleteMain } from '../../cli/mission-control-execution-mark-complete.ts';

const {
  listExecutionCoordinationPlans,
  inspectExecutionCoordinationPlan,
  inspectExecutionIntents,
  inspectExecutionRequests,
  inspectExecutionFeedbackLinks,
  inspectExecutionStatus,
  inspectExecutionHistory,
  materializeExecutionCoordinationPlan,
  deferExecutionCoordinationPlan,
  markExecutionCoordinationPlanActive,
  markExecutionCoordinationPlanComplete,
} = vi.hoisted(() => ({
  listExecutionCoordinationPlans: vi.fn(() => [{ missionExecutionCoordinationPlanId: 'plan-1' }]),
  inspectExecutionCoordinationPlan: vi.fn(() => ({ missionExecutionCoordinationPlanId: 'plan-1' })),
  inspectExecutionIntents: vi.fn(() => []),
  inspectExecutionRequests: vi.fn(() => []),
  inspectExecutionFeedbackLinks: vi.fn(() => []),
  inspectExecutionStatus: vi.fn(() => ({ missionExecutionCoordinationPlanId: 'plan-1', status: 'pending_execution' })),
  inspectExecutionHistory: vi.fn(() => ({ missionExecutionCoordinationPlanId: 'plan-1', entries: [] })),
  materializeExecutionCoordinationPlan: vi.fn(() => ({ missionExecutionCoordinationPlanId: 'plan-1' })),
  deferExecutionCoordinationPlan: vi.fn(() => ({ statusPreview: { missionExecutionCoordinationPlanId: 'plan-1', status: 'execution_deferred' } })),
  markExecutionCoordinationPlanActive: vi.fn(() => ({ statusPreview: { missionExecutionCoordinationPlanId: 'plan-1', status: 'execution_active' } })),
  markExecutionCoordinationPlanComplete: vi.fn(() => ({ statusPreview: { missionExecutionCoordinationPlanId: 'plan-1', status: 'execution_completed' } })),
}));

vi.mock('../../mission-control/mission-execution-coordination-inspection.ts', () => ({
  createMissionExecutionCoordinationInspection: vi.fn(() => ({
    listExecutionCoordinationPlans,
    inspectExecutionCoordinationPlan,
    inspectExecutionIntents,
    inspectExecutionRequests,
    inspectExecutionFeedbackLinks,
    inspectExecutionStatus,
    inspectExecutionHistory,
  })),
}));

vi.mock('../../mission-control/mission-execution-coordination-manager.ts', () => ({
  createMissionExecutionCoordinationManager: vi.fn(() => ({
    materializeExecutionCoordinationPlan,
    deferExecutionCoordinationPlan,
    markExecutionCoordinationPlanActive,
    markExecutionCoordinationPlanComplete,
  })),
}));

describe('mission execution coordination cli', () => {
  it('T-MEC-CLI1 command routing is deterministic', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await listMain([]);
    await inspectMain(['--plan', 'plan-1']);
    await intentsMain(['--plan=plan-1']);
    await requestsMain(['--plan=plan-1']);
    await feedbackMain(['--plan=plan-1']);
    await statusMain(['--plan=plan-1']);
    await historyMain(['--plan=plan-1']);
    await materializeMain(['--plan=plan-1']);
    await deferMain(['--plan=plan-1']);
    await markActiveMain(['--plan=plan-1']);
    await markCompleteMain(['--plan=plan-1']);

    expect(listExecutionCoordinationPlans).toHaveBeenCalled();
    expect(inspectExecutionCoordinationPlan).toHaveBeenCalledWith({ missionExecutionCoordinationPlanId: 'plan-1' });
    expect(inspectExecutionIntents).toHaveBeenCalledWith({ missionExecutionCoordinationPlanId: 'plan-1' });
    expect(inspectExecutionRequests).toHaveBeenCalledWith({ missionExecutionCoordinationPlanId: 'plan-1' });
    expect(inspectExecutionFeedbackLinks).toHaveBeenCalledWith({ missionExecutionCoordinationPlanId: 'plan-1' });
    expect(inspectExecutionStatus).toHaveBeenCalledWith({ missionExecutionCoordinationPlanId: 'plan-1' });
    expect(inspectExecutionHistory).toHaveBeenCalledWith({ missionExecutionCoordinationPlanId: 'plan-1' });
    expect(materializeExecutionCoordinationPlan).toHaveBeenCalledWith({ missionExecutionCoordinationPlanId: 'plan-1' });

    stdout.mockRestore();
  });

  it('T-MEC-CLI2 parse failures return stable JSON errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --plan' })}\n`);

    stdout.mockRestore();
  });
});
