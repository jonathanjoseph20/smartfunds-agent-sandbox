import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as listMain } from '../../cli/mission-control-orchestration-list.ts';
import { main as inspectMain } from '../../cli/mission-control-orchestration-inspect.ts';
import { main as strategiesMain } from '../../cli/mission-control-orchestration-strategies.ts';
import { main as actionsMain } from '../../cli/mission-control-orchestration-actions.ts';
import { main as queueMain } from '../../cli/mission-control-orchestration-queue.ts';
import { main as priorityMain } from '../../cli/mission-control-orchestration-priority.ts';
import { main as historyMain } from '../../cli/mission-control-orchestration-history.ts';
import { main as materializeMain } from '../../cli/mission-control-orchestration-materialize.ts';

const {
  listInterventionPlans,
  inspectInterventionPlan,
  listStabilizationStrategies,
  listOrchestrationActions,
  inspectOrchestrationQueue,
  inspectPriorityPosture,
  inspectOrchestrationHistory,
  materializeInterventionPlan,
} = vi.hoisted(() => ({
  listInterventionPlans: vi.fn(() => [{ missionControlInterventionPlanId: 'plan-1' }]),
  inspectInterventionPlan: vi.fn(() => ({ missionControlInterventionPlanId: 'plan-1' })),
  listStabilizationStrategies: vi.fn(() => []),
  listOrchestrationActions: vi.fn(() => []),
  inspectOrchestrationQueue: vi.fn(() => []),
  inspectPriorityPosture: vi.fn(() => ({ missionControlInterventionPlanId: 'plan-1', priority: 'high' })),
  inspectOrchestrationHistory: vi.fn(() => ({ missionControlInterventionPlanId: 'plan-1', entries: [] })),
  materializeInterventionPlan: vi.fn(() => ({ missionControlInterventionPlanId: 'plan-1' })),
}));

vi.mock('../../mission-control/mission-control-orchestration-inspection.ts', () => ({
  createMissionControlOrchestrationInspection: vi.fn(() => ({
    listInterventionPlans,
    inspectInterventionPlan,
    listStabilizationStrategies,
    listOrchestrationActions,
    inspectOrchestrationQueue,
    inspectPriorityPosture,
    inspectOrchestrationHistory,
  })),
}));

vi.mock('../../mission-control/mission-control-orchestration-manager.ts', () => ({
  createMissionControlOrchestrationManager: vi.fn(() => ({
    materializeInterventionPlan,
  })),
}));

describe('mission control orchestration cli', () => {
  it('T-MCO-CLI1 command routing is deterministic', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await listMain([]);
    await inspectMain(['--plan', 'plan-1']);
    await strategiesMain([]);
    await actionsMain(['--plan=plan-1']);
    await queueMain([]);
    await priorityMain(['--plan', 'plan-1']);
    await historyMain(['--plan=plan-1']);
    await materializeMain(['--plan', 'plan-1']);

    expect(listInterventionPlans).toHaveBeenCalled();
    expect(inspectInterventionPlan).toHaveBeenCalledWith({ missionControlInterventionPlanId: 'plan-1' });
    expect(listStabilizationStrategies).toHaveBeenCalled();
    expect(listOrchestrationActions).toHaveBeenCalledWith({ missionControlInterventionPlanId: 'plan-1' });
    expect(inspectOrchestrationQueue).toHaveBeenCalled();
    expect(inspectPriorityPosture).toHaveBeenCalledWith({ missionControlInterventionPlanId: 'plan-1' });
    expect(inspectOrchestrationHistory).toHaveBeenCalledWith({ missionControlInterventionPlanId: 'plan-1' });
    expect(materializeInterventionPlan).toHaveBeenCalledWith({ missionControlInterventionPlanId: 'plan-1' });

    stdout.mockRestore();
  });

  it('T-MCO-CLI2 parse failures return stable JSON errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --plan' })}\n`);

    stdout.mockRestore();
  });
});
