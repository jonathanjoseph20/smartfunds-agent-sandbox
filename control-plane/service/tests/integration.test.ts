import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.ts';
import type { RuntimeServiceConfig } from '../config/schema.ts';

function config(): RuntimeServiceConfig {
  return {
    runtimePort: 3100,
    env: 'test',
    logLevel: 'info',
    runtimeBaseUrl: 'http://127.0.0.1:3100',
    cockpitPort: 5173,
    corsOrigin: 'http://127.0.0.1:5173',
    slackBotToken: null,
    slackSigningSecret: null,
    dataDir: './data',
    configDir: './control-plane'
  };
}

describe('runtime integration smoke', () => {
  it('T-S74-I1 starts mission, lists runs, inspects run, retries node', async () => {
    const startMission = vi.fn(async () => ({ missionId: 'm1', workflowRun: 'run_1' }));
    const listWorkflows = vi.fn(() => [{ runId: 'run_1', workflowId: 'wf_1', missionId: 'm1' }]);
    const inspectWorkflow = vi.fn(() => ({
      runId: 'run_1',
      workflowId: 'wf_1',
      missionId: 'm1',
      nodeStates: [{ nodeId: 'node_a', status: 'failed' }]
    }));
    const retryWorkflowNode = vi.fn(async () => ({ runId: 'run_1', nodeId: 'node_a', scheduled: true }));

    const app = createApp({
      config: config(),
      logger: vi.fn(),
      services: {
        missionService: {
          listMissions: vi.fn(() => [{ missionId: 'm1' }]),
          inspectMission: vi.fn(() => ({ missionId: 'm1' })),
          startMission,
          cancelMission: vi.fn()
        } as never,
        workflowService: {
          listWorkflows,
          inspectWorkflow,
          traceWorkflow: vi.fn(() => ({ runId: 'run_1', trace: [] }))
        } as never,
        runtimeService: {
          retryWorkflowNode,
          resumeWorkflow: vi.fn(async () => ({ runId: 'run_1', resumed: true })),
          cancelWorkflow: vi.fn(() => ({ runId: 'run_1', status: 'cancelled' }))
        } as never
      }
    });

    const start = await app.dispatch({
      method: 'POST',
      pathname: '/missions/m1/start',
      query: new URLSearchParams(),
      bodyText: JSON.stringify({ params: { market: 'ethereum' } }),
      headers: { origin: 'http://127.0.0.1:5173' }
    });
    expect(start.statusCode).toBe(201);

    const runs = await app.dispatch({
      method: 'GET',
      pathname: '/runs',
      query: new URLSearchParams(),
      bodyText: null,
      headers: { origin: 'http://127.0.0.1:5173' }
    });
    expect(runs.statusCode).toBe(200);

    const inspect = await app.dispatch({
      method: 'GET',
      pathname: '/runs/run_1',
      query: new URLSearchParams(),
      bodyText: null,
      headers: { origin: 'http://127.0.0.1:5173' }
    });
    expect(inspect.statusCode).toBe(200);

    const retry = await app.dispatch({
      method: 'POST',
      pathname: '/runs/run_1/retry',
      query: new URLSearchParams(),
      bodyText: JSON.stringify({ nodeId: 'node_a' }),
      headers: { origin: 'http://127.0.0.1:5173' }
    });

    expect(retry.statusCode).toBe(200);
    expect(startMission).toHaveBeenCalledTimes(1);
    expect(listWorkflows).toHaveBeenCalledTimes(1);
    expect(inspectWorkflow).toHaveBeenCalledTimes(1);
    expect(retryWorkflowNode).toHaveBeenCalledWith({ runId: 'run_1', nodeId: 'node_a' });
  });
});
