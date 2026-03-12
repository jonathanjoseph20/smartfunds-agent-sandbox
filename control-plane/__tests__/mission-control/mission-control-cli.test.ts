import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as listMain } from '../../cli/mission-control-list.ts';
import { main as inspectMain } from '../../cli/mission-control-inspect.ts';
import { main as statusMain } from '../../cli/mission-control-status.ts';
import { main as progressMain } from '../../cli/mission-control-progress.ts';
import { main as healthMain } from '../../cli/mission-control-health.ts';
import { main as completionMain } from '../../cli/mission-control-completion.ts';
import { main as escalationsMain } from '../../cli/mission-control-escalations.ts';
import { main as historyMain } from '../../cli/mission-control-history.ts';
import { main as materializeMain } from '../../cli/mission-control-materialize.ts';

const {
  listMissionRuns,
  inspectMissionRun,
  inspectMissionProgress,
  inspectMissionStatus,
  inspectMissionEscalations,
  inspectMissionHistory,
  evaluateMissionRun,
  materializeOne,
} = vi.hoisted(() => ({
  listMissionRuns: vi.fn(() => [{ missionRunId: 'run-1' }]),
  inspectMissionRun: vi.fn(() => ({
    missionRunId: 'run-1',
    missionId: 'mission-1',
    operationalState: 'active',
    completionState: 'in_progress',
    healthState: 'unstable',
    blockingReasons: [],
    progressSummary: {
      completionPercent: 50,
      totalTaskCount: 2,
      completedTaskCount: 1,
      failedTaskCount: 0,
      blockedTaskCount: 0,
    },
  })),
  inspectMissionProgress: vi.fn(() => ({ completionPercent: 50 })),
  inspectMissionStatus: vi.fn(() => ({ missionRunId: 'run-1', operationalState: 'active' })),
  inspectMissionEscalations: vi.fn(() => []),
  inspectMissionHistory: vi.fn(() => ({ missionRunId: 'run-1', entries: [] })),
  evaluateMissionRun: vi.fn(() => ({ missionRunId: 'run-1', entries: [] })),
  materializeOne: vi.fn(() => ({ missionRunId: 'run-1' })),
}));

vi.mock('../../mission-control/mission-run-inspection.ts', () => ({
  createMissionRunInspection: vi.fn(() => ({
    listMissionRuns,
    inspectMissionRun,
    inspectMissionProgress,
    inspectMissionStatus,
    inspectMissionEscalations,
    inspectMissionHistory,
    evaluateMissionRun,
  })),
}));

vi.mock('../../mission-control/mission-run-materializer.ts', () => ({
  createMissionRunMaterializer: vi.fn(() => ({
    materializeOne,
  })),
}));

describe('mission control cli', () => {
  it('T-MC-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listMissionRuns())}\n`);
    stdout.mockRestore();
  });

  it('T-MC-CLI2 run-scoped commands require --run and route correctly', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await inspectMain(['--run', 'run-1']);
    await statusMain(['--run=run-1']);
    await progressMain(['--run', 'run-1']);
    await healthMain(['--run=run-1']);
    await completionMain(['--run', 'run-1']);
    await escalationsMain(['--run', 'run-1']);
    await historyMain(['--run=run-1']);
    await materializeMain(['--run', 'run-1']);

    expect(inspectMissionRun).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectMissionStatus).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectMissionProgress).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectMissionEscalations).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(evaluateMissionRun).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectMissionHistory).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(materializeOne).toHaveBeenCalledWith({ missionRunId: 'run-1' });

    stdout.mockRestore();
  });

  it('T-MC-CLI3 stable error payload is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectMissionRun.mockImplementationOnce(() => {
      throw new Error('MISSION_RUN_NOT_FOUND');
    });

    const code = await inspectMain(['--run', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSION_RUN_NOT_FOUND' })}\n`);
    stdout.mockRestore();
  });
});
