import { describe, expect, it, vi } from 'vitest';

import { createSlackRouter } from '../slack-router.ts';

function buildController() {
  return {
    startMission: vi.fn(async (missionId: string) => ({ missionId, workflowRun: 'run_1', teamId: 'research-team', status: 'running' })),
    getStatus: vi.fn((missionId: string) => ({ missionId, status: 'running', nodeStates: [{ nodeId: 'n1' }] })),
    cancelMission: vi.fn((missionId: string) => ({ missionId, runId: 'run_1', status: 'cancelled' })),
    getLogs: vi.fn((missionId: string) => ({ missionId, runId: 'run_1', trace: [{ t: 1 }, { t: 2 }] })),
    getArtifacts: vi.fn((missionId: string) => ({ missionId, artifacts: ['artifacts/m1/companies.csv'] }))
  };
}

describe('slack router', () => {
  it('T-S80-R1 routes mission command set', async () => {
    const controller = buildController();
    const router = createSlackRouter(controller, {
      listMissions: () => [{ missionId: 'a', status: 'running' }, { missionId: 'b', status: 'created' }]
    });

    await expect(router.handleCommand('/mission', ['run', 'stratum-dealflow'])).resolves.toMatchObject({ ok: true });
    await expect(router.handleCommand('/mission', ['status', 'stratum-dealflow'])).resolves.toMatchObject({ ok: true });
    await expect(router.handleCommand('/mission', ['list'])).resolves.toMatchObject({ ok: true });
    await expect(router.handleCommand('/mission', ['logs', 'stratum-dealflow'])).resolves.toMatchObject({ ok: true });
    await expect(router.handleCommand('/mission', ['cancel', 'stratum-dealflow'])).resolves.toMatchObject({ ok: true });

    expect(controller.startMission).toHaveBeenCalledWith('stratum-dealflow');
    expect(controller.getStatus).toHaveBeenCalledWith('stratum-dealflow');
    expect(controller.getLogs).toHaveBeenCalledWith('stratum-dealflow');
    expect(controller.cancelMission).toHaveBeenCalledWith('stratum-dealflow');
  });

  it('T-S80-R2 routes artifact command and returns upload list', async () => {
    const controller = buildController();
    const router = createSlackRouter(controller);

    const result = await router.handleCommand('/artifact', ['stratum-dealflow']);

    expect(result).toMatchObject({ ok: true, artifacts: ['artifacts/m1/companies.csv'] });
    expect(controller.getArtifacts).toHaveBeenCalledWith('stratum-dealflow');
  });

  it('T-S80-R3 returns deterministic errors for missing args and unknown subcommands', async () => {
    const controller = buildController();
    const router = createSlackRouter(controller);

    await expect(router.handleCommand('/mission', ['run'])).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_COMMAND' })
    });

    await expect(router.handleCommand('/mission', ['unknown', 'm1'])).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_COMMAND' })
    });

    await expect(router.handleCommand('/artifact', [])).resolves.toEqual({
      ok: false,
      error: { code: 'MISSING_ARGUMENT', message: 'Missing required <mission-id> for /artifact' }
    });
  });

  it('T-S81-R5 always serves /mission help without controller calls', async () => {
    const controller = buildController();
    const router = createSlackRouter(controller);

    const result = await router.handleCommand('/mission', ['help']);
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.message.text).toBe('Mission command help');
    expect(controller.startMission).not.toHaveBeenCalled();
    expect(controller.getStatus).not.toHaveBeenCalled();
  });

  it('T-S80-R4 wraps controller failures', async () => {
    const controller = buildController();
    controller.getLogs.mockImplementationOnce(() => {
      throw new Error('MISSION_RUN_NOT_FOUND: m1');
    });

    const router = createSlackRouter(controller);

    await expect(router.handleCommand('/mission', ['logs', 'm1'])).resolves.toEqual({
      ok: false,
      error: { code: 'CONTROLLER_ERROR', message: 'MISSION_RUN_NOT_FOUND: m1' }
    });
  });
});
