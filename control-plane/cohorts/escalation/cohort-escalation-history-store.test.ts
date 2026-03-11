import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCohortEscalationHistoryStore } from './cohort-escalation-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-cohort-escalation-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('cohort escalation history store', () => {
  it('T-CE-H1 appends transitions in stable order and dedupes equivalent transitions', () => {
    const store = createCohortEscalationHistoryStore({
      cohortArtifactsRoot: path.join(tmpRoot, 'artifacts', 'cohorts')
    });

    const first = store.appendTransition({
      cohortId: 'aave-risk',
      projection: {
        cohortId: 'aave-risk',
        escalationState: 'elevated',
        escalationReasons: ['cohort_health_degraded'],
        linkedSignals: ['sig-1'],
        linkedSyntheses: [],
        linkedInvestigations: ['inv-1'],
        linkedProgramIds: ['aave-risk-monitor'],
        slotOrReference: 'daily:2026-03-11'
      }
    });

    const duplicate = store.appendTransition({
      cohortId: 'aave-risk',
      projection: {
        cohortId: 'aave-risk',
        escalationState: 'elevated',
        escalationReasons: ['cohort_health_degraded'],
        linkedSignals: ['sig-1'],
        linkedSyntheses: [],
        linkedInvestigations: ['inv-1'],
        linkedProgramIds: ['aave-risk-monitor'],
        slotOrReference: 'daily:2026-03-11'
      }
    });

    const second = store.appendTransition({
      cohortId: 'aave-risk',
      projection: {
        cohortId: 'aave-risk',
        escalationState: 'critical',
        escalationReasons: ['cohort_health_unstable'],
        linkedSignals: ['sig-1', 'sig-2'],
        linkedSyntheses: ['syn-1'],
        linkedInvestigations: ['inv-1', 'inv-2'],
        linkedProgramIds: ['aave-risk-monitor'],
        slotOrReference: 'daily:2026-03-12'
      }
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    const history = store.load({ cohortId: 'aave-risk' });
    expect(history.entries).toHaveLength(2);
    expect(history.entries[0].slotOrReference).toBe('daily:2026-03-12');
    expect(history.entries[1].slotOrReference).toBe('daily:2026-03-11');
  });
});
