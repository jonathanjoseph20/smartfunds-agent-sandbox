import { describe, expect, it, vi } from 'vitest';

import { createOperatorCommandRouter } from './command-router.ts';

describe('operator command router', () => {
  it('T-S77-R1 routes mission create|list|run|status aliases', async () => {
    const createMission = vi.fn(() => ({ missionId: 'mission-001' }));
    const listRuntimeMissions = vi.fn(() => [{ missionId: 'mission-001' }]);
    const runMission = vi.fn(async () => ({ missionId: 'mission-001', status: 'running' }));
    const missionStatus = vi.fn(() => ({ missionId: 'mission-001', status: 'created' }));

    const router = createOperatorCommandRouter({
      services: {
        mission: {
          createMission,
          runMission,
          missionStatus,
          listRuntimeMissions,
          startMission: vi.fn(),
          listMissions: vi.fn(),
          inspectMission: vi.fn(),
          cancelMission: vi.fn()
        },
        workflow: {
          listWorkflows: vi.fn(),
          inspectWorkflow: vi.fn(),
          traceWorkflow: vi.fn()
        },
        runtime: {
          retryWorkflowNode: vi.fn(),
          resumeWorkflow: vi.fn(),
          cancelWorkflow: vi.fn()
        }
      }
    });

    await router.route({ source: 'cli', argv: ['mission', 'create', 'tokenization-legal-analysis'] });
    await router.route({ source: 'cli', argv: ['mission', 'list'] });
    await router.route({ source: 'cli', argv: ['mission', 'run', 'mission-001'] });
    await router.route({ source: 'cli', argv: ['mission', 'status', 'mission-001'] });

    expect(createMission).toHaveBeenCalledWith({ templateId: 'tokenization-legal-analysis' });
    expect(listRuntimeMissions).toHaveBeenCalledTimes(1);
    expect(runMission).toHaveBeenCalledWith({ missionId: 'mission-001' });
    expect(missionStatus).toHaveBeenCalledWith({ missionId: 'mission-001' });
  });

  it('T-OPR1 routes mission:list through mission service', async () => {
    const missionList = vi.fn(() => [{ missionId: 'rwa-market-analysis', status: 'running' }]);

    const router = createOperatorCommandRouter({
      services: {
        mission: {
          createMission: vi.fn(),
          runMission: vi.fn(),
          missionStatus: vi.fn(),
          listRuntimeMissions: vi.fn(),
          startMission: vi.fn(),
          listMissions: missionList,
          inspectMission: vi.fn(),
          cancelMission: vi.fn()
        },
        workflow: {
          listWorkflows: vi.fn(),
          inspectWorkflow: vi.fn(),
          traceWorkflow: vi.fn()
        },
        runtime: {
          retryWorkflowNode: vi.fn(),
          resumeWorkflow: vi.fn(),
          cancelWorkflow: vi.fn()
        }
      }
    });

    const result = await router.route({
      source: 'cli',
      argv: ['mission:list']
    });

    expect(result).toEqual({
      success: true,
      command: {
        name: 'mission:list',
        source: 'cli'
      },
      payload: [{ missionId: 'rwa-market-analysis', status: 'running' }]
    });
    expect(missionList).toHaveBeenCalledTimes(1);
  });

  it('T-OPR2 returns deterministic structured errors for parser failures', async () => {
    const router = createOperatorCommandRouter({
      services: {
        mission: {
          createMission: vi.fn(),
          runMission: vi.fn(),
          missionStatus: vi.fn(),
          listRuntimeMissions: vi.fn(),
          startMission: vi.fn(),
          listMissions: vi.fn(),
          inspectMission: vi.fn(),
          cancelMission: vi.fn()
        },
        workflow: {
          listWorkflows: vi.fn(),
          inspectWorkflow: vi.fn(),
          traceWorkflow: vi.fn()
        },
        runtime: {
          retryWorkflowNode: vi.fn(),
          resumeWorkflow: vi.fn(),
          cancelWorkflow: vi.fn()
        }
      }
    });

    const result = await router.route({
      source: 'cli',
      argv: ['workflow:retry', '--run', 'run_1']
    });

    expect(result.success).toBe(false);
    expect(result.error).toEqual({
      code: 'MISSING_ARGUMENT',
      message: 'Missing required --node'
    });
  });

  it('T-S77-R2 preserves mission:start compatibility', async () => {
    const startMission = vi.fn(async () => ({ missionId: 'legacy' }));
    const router = createOperatorCommandRouter({
      services: {
        mission: {
          createMission: vi.fn(),
          runMission: vi.fn(),
          missionStatus: vi.fn(),
          listRuntimeMissions: vi.fn(),
          startMission,
          listMissions: vi.fn(),
          inspectMission: vi.fn(),
          cancelMission: vi.fn()
        },
        workflow: {
          listWorkflows: vi.fn(),
          inspectWorkflow: vi.fn(),
          traceWorkflow: vi.fn()
        },
        runtime: {
          retryWorkflowNode: vi.fn(),
          resumeWorkflow: vi.fn(),
          cancelWorkflow: vi.fn()
        }
      }
    });

    await router.route({
      source: 'cli',
      argv: ['mission:start', 'legacy', '--market', 'us']
    });

    expect(startMission).toHaveBeenCalledWith({ missionId: 'legacy', params: { market: 'us' } });
  });
});
