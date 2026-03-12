import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeMissionCoordinationHistoryEventDedupeKey,
  createMissionLifecycleHistoryStore,
} from '../../mission-control/mission-lifecycle-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-coordination-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission lifecycle history store', () => {
  it('T-MCH1 appends deterministically and dedupes equivalent entries', () => {
    const store = createMissionLifecycleHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      missionRunId: 'run-1',
      eventType: 'mission_intervention_recorded',
      reasonTokens: ['operator_pause'],
      payload: {
        intervention: {
          missionInterventionId: 'int-1',
        },
      },
    });

    const second = store.append({
      missionRunId: 'run-1',
      eventType: 'mission_intervention_recorded',
      reasonTokens: ['operator_pause'],
      payload: {
        intervention: {
          missionInterventionId: 'int-1',
        },
      },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MCH2 maintains deterministic replay ordering', () => {
    const store = createMissionLifecycleHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      missionRunId: 'run-1',
      eventType: 'mission_priority_updated',
      payload: {
        prioritySignal: {
          missionRunId: 'run-1',
          priority: 'high',
          reasonTokens: ['priority_up'],
        },
      },
    });

    store.append({
      missionRunId: 'run-1',
      eventType: 'mission_dependency_linked',
      payload: {
        relationship: {
          missionRelationshipId: 'rel-1',
          sourceMissionRunId: 'run-1',
          targetMissionRunId: 'run-2',
          relationshipType: 'depends_on',
          blockingReasonTokens: ['dep'],
          state: 'active',
        },
      },
    });

    const firstReplay = store.replay({ missionRunId: 'run-1' });
    const secondReplay = store.replay({ missionRunId: 'run-1' });

    expect(secondReplay).toEqual(firstReplay);
    expect(firstReplay.map((entry) => entry.eventType)).toEqual([
      'mission_priority_updated',
      'mission_dependency_linked',
    ]);
  });

  it('T-MCH3 computes deterministic dedupe key', () => {
    const input = {
      missionRunId: 'run-1',
      eventType: 'mission_priority_updated' as const,
      reasonTokens: ['risk'],
      payload: {
        prioritySignal: {
          missionRunId: 'run-1',
          priority: 'high',
          reasonTokens: ['risk'],
        },
      },
    };

    expect(computeMissionCoordinationHistoryEventDedupeKey(input)).toBe(computeMissionCoordinationHistoryEventDedupeKey(input));
  });
});
