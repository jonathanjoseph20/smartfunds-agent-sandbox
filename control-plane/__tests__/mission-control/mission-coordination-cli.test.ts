import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as lifecycleMain } from '../../cli/mission-control-lifecycle.ts';
import { main as coordinationMain } from '../../cli/mission-control-coordination.ts';
import { main as dependenciesMain } from '../../cli/mission-control-dependencies.ts';
import { main as priorityMain } from '../../cli/mission-control-priority.ts';
import { main as interventionsMain } from '../../cli/mission-control-interventions.ts';
import { main as pauseMain } from '../../cli/mission-control-pause.ts';
import { main as resumeMain } from '../../cli/mission-control-resume.ts';
import { main as cancelMain } from '../../cli/mission-control-cancel.ts';
import { main as reprioritizeMain } from '../../cli/mission-control-reprioritize.ts';
import { main as historyMain } from '../../cli/mission-control-coordination-history.ts';
import { main as materializeMain } from '../../cli/mission-control-materialize-coordination.ts';

const {
  inspectMissionLifecycle,
  inspectMissionCoordination,
  inspectMissionDependencies,
  inspectMissionPriority,
  inspectMissionInterventions,
  inspectMissionCoordinationHistory,
  pauseMission,
  resumeMission,
  cancelMission,
  reprioritizeMission,
  materializeOne,
} = vi.hoisted(() => ({
  inspectMissionLifecycle: vi.fn(() => ({ missionRunId: 'run-1', lifecycleState: 'active' })),
  inspectMissionCoordination: vi.fn(() => ({ missionRunId: 'run-1', coordinationState: 'active' })),
  inspectMissionDependencies: vi.fn(() => []),
  inspectMissionPriority: vi.fn(() => ({ missionRunId: 'run-1', priority: 'normal' })),
  inspectMissionInterventions: vi.fn(() => []),
  inspectMissionCoordinationHistory: vi.fn(() => ({ missionRunId: 'run-1', entries: [] })),
  pauseMission: vi.fn(() => ({ missionRunId: 'run-1' })),
  resumeMission: vi.fn(() => ({ missionRunId: 'run-1' })),
  cancelMission: vi.fn(() => ({ missionRunId: 'run-1' })),
  reprioritizeMission: vi.fn(() => ({ missionRunId: 'run-1', priority: { priority: 'high' } })),
  materializeOne: vi.fn(() => ({ missionRunId: 'run-1' })),
}));

vi.mock('../../mission-control/mission-coordination-inspection.ts', () => ({
  createMissionCoordinationInspection: vi.fn(() => ({
    inspectMissionLifecycle,
    inspectMissionCoordination,
    inspectMissionDependencies,
    inspectMissionPriority,
    inspectMissionInterventions,
    inspectMissionCoordinationHistory,
  })),
}));

vi.mock('../../mission-control/mission-coordination-manager.ts', () => ({
  createMissionCoordination: vi.fn(() => ({
    pauseMission,
    resumeMission,
    cancelMission,
    reprioritizeMission,
  })),
}));

vi.mock('../../mission-control/mission-coordination-materializer.ts', () => ({
  createMissionCoordinationMaterializer: vi.fn(() => ({
    materializeOne,
  })),
}));

describe('mission coordination cli', () => {
  it('T-MCCLI1 inspection commands route --run', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await lifecycleMain(['--run', 'run-1']);
    await coordinationMain(['--run=run-1']);
    await dependenciesMain(['--run', 'run-1']);
    await priorityMain(['--run=run-1']);
    await interventionsMain(['--run', 'run-1']);
    await historyMain(['--run', 'run-1']);
    await materializeMain(['--run', 'run-1']);

    expect(inspectMissionLifecycle).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectMissionCoordination).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectMissionDependencies).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectMissionPriority).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectMissionInterventions).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectMissionCoordinationHistory).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(materializeOne).toHaveBeenCalledWith({ missionRunId: 'run-1' });

    stdout.mockRestore();
  });

  it('T-MCCLI2 action commands append coordination actions only', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await pauseMain(['--run', 'run-1', '--by', 'operator', '--reason', 'pause']);
    await resumeMain(['--run', 'run-1', '--by=operator']);
    await cancelMain(['--run=run-1']);
    await reprioritizeMain(['--run', 'run-1', '--priority', 'high']);

    expect(pauseMission).toHaveBeenCalled();
    expect(resumeMission).toHaveBeenCalled();
    expect(cancelMission).toHaveBeenCalled();
    expect(reprioritizeMission).toHaveBeenCalled();

    stdout.mockRestore();
  });

  it('T-MCCLI3 lifecycle transition errors preserve stable JSON payload', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    pauseMission.mockImplementationOnce(() => ({
      error: 'invalid_lifecycle_transition',
      missionRunId: 'run-1',
      fromState: 'ready',
      toState: 'paused',
    }));

    const code = await pauseMain(['--run', 'run-1']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({
      error: 'invalid_lifecycle_transition',
      missionRunId: 'run-1',
      fromState: 'ready',
      toState: 'paused',
    })}\n`);

    stdout.mockRestore();
  });
});
