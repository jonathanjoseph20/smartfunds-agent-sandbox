import { describe, expect, it, vi } from 'vitest';

import { createSlackNotifier } from '../slack-notifier.ts';

describe('slack notifier', () => {
  it('T-S80-N1 posts lifecycle notifications to channel', async () => {
    const postMessage = vi.fn(async () => undefined);
    const notifier = createSlackNotifier({
      postMessage,
      uploadFile: vi.fn(async () => undefined),
      postEphemeral: vi.fn(async () => undefined)
    }, 'C-OPS');

    await notifier.notify('mission_started', { missionId: 'stratum-dealflow', runId: 'run_1' });
    await notifier.notify('mission_completed', { missionId: 'stratum-dealflow' });
    await notifier.notify('mission_failed', { missionId: 'stratum-dealflow' });
    await notifier.notify('artifact_ready', { missionId: 'stratum-dealflow', artifacts: ['companies.csv'] });

    expect(postMessage).toHaveBeenCalledTimes(4);
    expect(postMessage.mock.calls[0]?.[0]).toBe('C-OPS');
  });
});
