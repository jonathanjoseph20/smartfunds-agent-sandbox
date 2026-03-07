import { describe, expect, it, vi } from 'vitest';

import { createOperatorCommandRouter } from './command-router.ts';

describe('operator command router', () => {
  it('T-OPR1 routes mission:list through mission service', async () => {
    const missionList = vi.fn(() => [{ missionId: 'rwa-market-analysis', status: 'running' }]);

    const router = createOperatorCommandRouter({
      services: {
        mission: {
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
});
