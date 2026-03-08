import { describe, expect, it } from 'vitest';

import { formatSlackRunSummary } from '../slack-run-summary.ts';

describe('slack run summary', () => {
  it('T-S81-S1 formats completion summary with metrics and artifacts', () => {
    const message = formatSlackRunSummary({
      missionId: 'stratum-dealflow',
      status: 'completed',
      resultCounts: {
        companies_discovered: 14,
        contacts_extracted: 6
      },
      artifacts: ['outreach_targets.xlsx', 'companies.csv']
    });

    expect(message.text).toBe('Mission completed: stratum-dealflow');
    const content = JSON.stringify(message.blocks);
    expect(content).toContain('Companies discovered: 14');
    expect(content).toContain('outreach_targets.xlsx');
  });

  it('T-S81-S2 formats failure summary without stack traces', () => {
    const message = formatSlackRunSummary({
      missionId: 'stratum-dealflow',
      status: 'failed',
      failureCode: 'STEP_TIMEOUT',
      failureMessage: 'STEP_TIMEOUT: browser_fetch\nError: stack details'
    });

    expect(message.text).toBe('Mission failed: stratum-dealflow');
    const content = JSON.stringify(message.blocks);
    expect(content).toContain('Failure Code: STEP_TIMEOUT');
    expect(content).toContain('Failure: STEP_TIMEOUT: browser_fetch');
    expect(content).not.toContain('stack details');
  });
});
