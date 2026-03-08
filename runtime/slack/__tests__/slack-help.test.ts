import { describe, expect, it } from 'vitest';

import { formatSlackHelpMessage, slackHelpUsageText } from '../slack-help.ts';

describe('slack help', () => {
  it('T-S81-H1 formats deterministic help payload', () => {
    const message = formatSlackHelpMessage();
    expect(message.text).toBe('Mission command help');
    expect(JSON.stringify(message.blocks)).toContain('/mission help');
    expect(slackHelpUsageText()).toContain('/artifact <missionId>');
  });
});
