import { describe, expect, it, vi } from 'vitest';

import { createSlackNotifier, formatMissionCompletionNotification } from './slack-notifier.ts';

describe('slack adapter notifier', () => {
  it('T-S84-N1 formats deterministic completion notification text', () => {
    const text = formatMissionCompletionNotification({
      missionId: 'research-web-intelligence',
      runId: 'run_smartfunds-core_0004',
      artifacts: ['report.md', 'dataset.csv', 'report.md', 'search-results.json']
    });

    expect(text).toBe([
      'Mission completed',
      '',
      'mission: research-web-intelligence',
      'runId: run_smartfunds-core_0004',
      '',
      'Artifacts available',
      'dataset.csv',
      'report.md',
      'search-results.json'
    ].join('\n'));
  });

  it('T-S84-N2 sends notifications only when channel is configured', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const enabledNotifier = createSlackNotifier({
      channel: 'C-OPS',
      sendMessage
    });

    await enabledNotifier.notifyMissionCompleted({
      missionId: 'research-web-intelligence',
      runId: 'run_smartfunds-core_0004',
      artifacts: []
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);

    const disabledNotifier = createSlackNotifier({
      channel: null,
      sendMessage
    });

    await disabledNotifier.notifyMissionCompleted({
      missionId: 'research-web-intelligence',
      runId: 'run_smartfunds-core_0005',
      artifacts: []
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
