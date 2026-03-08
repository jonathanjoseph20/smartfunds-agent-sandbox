import { describe, expect, it } from 'vitest';

import {
  formatArtifactList,
  formatMissionCancelled,
  formatMissionList,
  formatMissionLogs,
  formatMissionStarted,
  formatMissionStatus
} from '../slack-format.ts';

describe('slack format', () => {
  it('T-S80-F1 formats mission started payload deterministically', () => {
    const message = formatMissionStarted({
      missionId: 'stratum-dealflow',
      runId: 'run_001',
      teamId: 'research-team',
      status: 'running',
      agents: 3
    });

    expect(message.text).toBe('Mission started: stratum-dealflow');
    expect(message.blocks).toHaveLength(2);
  });

  it('T-S80-F2 clamps progress bar edge cases', () => {
    const low = formatMissionStatus({ missionId: 'm', status: 'running', progress: -1, agents: [] });
    const high = formatMissionStatus({ missionId: 'm', status: 'running', progress: 2, agents: [] });

    expect(JSON.stringify(low.blocks)).toContain('░░░░░░░░░░ 0%');
    expect(JSON.stringify(high.blocks)).toContain('██████████ 100%');
  });

  it('T-S80-F3 formats list, logs, cancel, and artifact responses', () => {
    expect(formatMissionList([{ missionId: 'b', status: 'running' }, { missionId: 'a', status: 'created' }]).text)
      .toBe('Mission list (2)');
    expect(formatMissionLogs({ missionId: 'm', runId: 'r1', eventCount: 4 }).text).toBe('Mission logs: m');
    expect(formatMissionCancelled({ missionId: 'm', runId: 'r1' }).text).toBe('Mission cancelled: m');
    expect(formatArtifactList({ missionId: 'm', artifacts: ['z.csv', 'a.csv'] }).text).toBe('Artifacts for m');
  });
});
