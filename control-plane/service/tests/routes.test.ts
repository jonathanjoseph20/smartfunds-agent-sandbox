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

describe('runtime routes', () => {
  it('T-S74-R1 GET /missions returns deterministic envelope', async () => {
    const app = createApp({
      config: config(),
      logger: vi.fn(),
      services: {
        missionService: {
          listMissions: () => [{ missionId: 'm1' }],
          inspectMission: vi.fn(),
          startMission: vi.fn(),
          cancelMission: vi.fn()
        } as never,
        workflowService: {
          listWorkflows: vi.fn(() => []),
          inspectWorkflow: vi.fn(),
          traceWorkflow: vi.fn()
        } as never,
        runtimeService: {
          retryWorkflowNode: vi.fn(),
          resumeWorkflow: vi.fn(),
          cancelWorkflow: vi.fn()
        } as never
      }
    });

    const response = await app.dispatch({
      method: 'GET',
      pathname: '/missions',
      query: new URLSearchParams(),
      bodyText: null,
      headers: {
        origin: 'http://127.0.0.1:5173'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(response.payload).toEqual({
      success: true,
      payload: [{ missionId: 'm1' }],
      meta: {
        source: 'operator-runtime-api',
        version: 'v1'
      }
    });
  });

  it('T-S74-R2 POST /missions/:missionId/start forwards params and preserves envelope', async () => {
    const startMission = vi.fn(async () => ({ runId: 'run_123' }));
    const app = createApp({
      config: config(),
      logger: vi.fn(),
      services: {
        missionService: {
          listMissions: vi.fn(() => []),
          inspectMission: vi.fn(),
          startMission,
          cancelMission: vi.fn()
        } as never,
        workflowService: {
          listWorkflows: vi.fn(() => []),
          inspectWorkflow: vi.fn(),
          traceWorkflow: vi.fn()
        } as never,
        runtimeService: {
          retryWorkflowNode: vi.fn(),
          resumeWorkflow: vi.fn(),
          cancelWorkflow: vi.fn()
        } as never
      }
    });

    const response = await app.dispatch({
      method: 'POST',
      pathname: '/missions/rwa-market-analysis/start',
      query: new URLSearchParams(),
      bodyText: JSON.stringify({ params: { market: 'ethereum' } }),
      headers: {
        origin: 'http://127.0.0.1:5173'
      }
    });

    expect(startMission).toHaveBeenCalledWith({ missionId: 'rwa-market-analysis', params: { market: 'ethereum' } });
    expect(response.statusCode).toBe(201);
    expect(response.payload).toEqual({
      success: true,
      payload: { runId: 'run_123' },
      meta: {
        source: 'operator-runtime-api',
        version: 'v1'
      }
    });
  });

  it('T-S74-R3 POST /runs/:runId/retry validates nodeId and emits deterministic error envelope', async () => {
    const app = createApp({
      config: config(),
      logger: vi.fn(),
      services: {
        missionService: {
          listMissions: vi.fn(() => []),
          inspectMission: vi.fn(),
          startMission: vi.fn(),
          cancelMission: vi.fn()
        } as never,
        workflowService: {
          listWorkflows: vi.fn(() => []),
          inspectWorkflow: vi.fn(),
          traceWorkflow: vi.fn()
        } as never,
        runtimeService: {
          retryWorkflowNode: vi.fn(),
          resumeWorkflow: vi.fn(),
          cancelWorkflow: vi.fn()
        } as never
      }
    });

    const response = await app.dispatch({
      method: 'POST',
      pathname: '/runs/run_1/retry',
      query: new URLSearchParams(),
      bodyText: JSON.stringify({}),
      headers: {
        origin: 'http://127.0.0.1:5173'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.payload).toEqual({
      success: false,
      error: {
        code: 'RUN_NODE_ID_INVALID',
        message: 'nodeId is required',
        details: {}
      }
    });
  });
});
