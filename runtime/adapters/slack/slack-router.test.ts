import { describe, expect, it, vi } from 'vitest';

import { createSlackRouter } from './slack-router.ts';

function buildController() {
  return {
    startMission: vi.fn(async (missionId: string) => ({
      missionId,
      workflowRun: 'run_smartfunds-core_0004'
    })),
    getRunStatus: vi.fn((runId: string) => ({
      runId,
      status: 'running',
      phase: 'extract-content'
    })),
    getArtifactsByRun: vi.fn((runId: string) => ({
      runId,
      missionId: 'rwa-market-analysis',
      artifacts: ['report.md', 'dataset.csv', 'search-results.json', 'research-pages.json']
    }))
  };
}

describe('slack adapter router', () => {
  it('T-S84-R1 parses /mission run and delegates mission launch', async () => {
    const controller = buildController();
    const router = createSlackRouter(controller);

    const result = await router.routeMissionText('run rwa-market-analysis');

    expect(result).toEqual({
      ok: true,
      text: [
        'Mission started',
        '',
        'mission: rwa-market-analysis',
        'runId: run_smartfunds-core_0004'
      ].join('\n')
    });
    expect(controller.startMission).toHaveBeenCalledWith('rwa-market-analysis');
  });

  it('T-S84-R2 parses /mission status by runId and formats deterministic output', async () => {
    const controller = buildController();
    const router = createSlackRouter(controller);

    const result = await router.routeMissionText('status run_smartfunds-core_0004');

    expect(result).toEqual({
      ok: true,
      text: [
        'Mission status',
        '',
        'runId: run_smartfunds-core_0004',
        'status: running',
        'phase: extract-content'
      ].join('\n')
    });
    expect(controller.getRunStatus).toHaveBeenCalledWith('run_smartfunds-core_0004');
  });

  it('T-S84-R3 parses /mission artifacts by runId and sorts artifact list deterministically', async () => {
    const controller = buildController();
    controller.getArtifactsByRun.mockReturnValueOnce({
      runId: 'run_smartfunds-core_0004',
      missionId: 'rwa-market-analysis',
      artifacts: ['search-results.json', 'dataset.csv', 'report.md', 'research-pages.json']
    });

    const router = createSlackRouter(controller);
    const result = await router.routeMissionText('artifacts run_smartfunds-core_0004');

    expect(result).toEqual({
      ok: true,
      text: [
        'Artifacts',
        '',
        'dataset.csv',
        'report.md',
        'research-pages.json',
        'search-results.json'
      ].join('\n')
    });
    expect(controller.getArtifactsByRun).toHaveBeenCalledWith('run_smartfunds-core_0004');
  });

  it('T-S84-R4 returns deterministic help text for malformed command input', async () => {
    const router = createSlackRouter(buildController());

    const result = await router.routeMissionText('run');

    expect(result).toEqual({
      ok: false,
      text: [
        'Error',
        '',
        'INVALID_COMMAND: expected exactly 2 arguments',
        '',
        'Usage:',
        '/mission run <missionId>',
        '/mission status <runId>',
        '/mission artifacts <runId>'
      ].join('\n')
    });
  });

  it('T-S84-R5 maps missing run errors deterministically', async () => {
    const controller = buildController();
    controller.getRunStatus.mockImplementationOnce(() => {
      throw new Error('Run not found: run_missing_0001');
    });

    const router = createSlackRouter(controller);
    const result = await router.routeMissionText('status run_missing_0001');

    expect(result).toEqual({
      ok: false,
      text: ['Error', '', 'RUN_NOT_FOUND: run_missing_0001'].join('\n')
    });
  });
});
