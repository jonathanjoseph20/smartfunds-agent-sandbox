import { describe, expect, it, vi } from 'vitest';

import { createSlackCommandRouter } from './slack-router.ts';

describe('operator slack router', () => {
  it('T-OPS1 routes slash mission command through command-router', async () => {
    const route = vi.fn(async () => ({
      success: true,
      command: { name: 'mission:start', source: 'slack' as const },
      payload: { missionId: 'rwa-market-analysis' }
    }));

    const slack = createSlackCommandRouter({
      router: { route }
    });

    const result = await slack.routeSlackText('/mission start rwa-market-analysis --market ethereum');

    expect(route).toHaveBeenCalledWith({
      source: 'slack',
      argv: ['mission:start', 'rwa-market-analysis', '--market', 'ethereum']
    });
    expect(result.success).toBe(true);
  });

  it('T-OPS2 rejects invalid slash command deterministically', async () => {
    const slack = createSlackCommandRouter({
      router: { route: vi.fn() }
    });

    const result = await slack.routeSlackText('/unknown test');

    expect(result).toEqual({
      success: false,
      command: {
        name: 'unknown',
        source: 'slack'
      },
      error: {
        code: 'SLACK_PARSE_ERROR',
        message: 'UNKNOWN_COMMAND: /unknown'
      }
    });
  });
});
