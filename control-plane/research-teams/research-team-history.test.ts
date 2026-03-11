import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createResearchTeamHistoryStore } from './research-team-history.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-research-team-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('research team history store', () => {
  it('T-RT-H1 appends activation and escalation deterministically and dedupes equivalent events', () => {
    const store = createResearchTeamHistoryStore({ artifactsRoot: tmpRoot });

    const first = store.append({
      teamId: 'defi-risk-team',
      eventType: 'team_activated',
      reason: 'cohort_degradation_detected',
      linkedCohortIds: ['aave-risk'],
      linkedInvestigationIds: ['inv-1'],
      slotReference: 'daily:2026-03-11'
    });

    const duplicate = store.append({
      teamId: 'defi-risk-team',
      eventType: 'team_activated',
      reason: 'cohort_degradation_detected',
      linkedCohortIds: ['aave-risk'],
      linkedInvestigationIds: ['inv-1'],
      slotReference: 'daily:2026-03-11'
    });

    const second = store.append({
      teamId: 'defi-risk-team',
      eventType: 'team_escalated',
      reason: 'cohort_escalation_detected',
      linkedCohortIds: ['aave-risk'],
      linkedInvestigationIds: ['inv-1', 'inv-2'],
      slotReference: 'daily:2026-03-12'
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    const history = store.load('defi-risk-team');
    expect(history.entries).toHaveLength(2);
    expect(history.entries[0]?.slotReference).toBe('daily:2026-03-12');
    expect(history.entries[1]?.slotReference).toBe('daily:2026-03-11');
  });
});
