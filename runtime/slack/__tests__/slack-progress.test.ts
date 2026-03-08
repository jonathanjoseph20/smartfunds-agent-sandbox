import { describe, expect, it } from 'vitest';

import { formatSlackProgress } from '../slack-progress.ts';

describe('slack progress', () => {
  it('T-S81-P1 formats progress events with step counts', () => {
    const message = formatSlackProgress('step_completed', {
      missionId: 'stratum-dealflow',
      stepIndex: 2,
      totalSteps: 7,
      stepName: 'page_fetch',
      status: 'complete'
    });

    expect(message.text).toBe('Step completed: stratum-dealflow');
    expect(JSON.stringify(message.blocks)).toContain('Step 2/7 page_fetch');
  });

  it('T-S81-P2 handles missing optional fields', () => {
    const message = formatSlackProgress('mission_started', {});
    expect(message.text).toBe('Mission started: unknown-mission');
    expect(JSON.stringify(message.blocks)).toContain('Mission: unknown-mission');
  });
});
