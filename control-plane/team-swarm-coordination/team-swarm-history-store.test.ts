import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeTeamSwarmEventDedupeKey,
  createTeamSwarmHistoryStore
} from './team-swarm-history-store.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-team-swarm-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('team swarm history store', () => {
  it('T-TS-H1 appends once and dedupes deterministic events', () => {
    const store = createTeamSwarmHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'team-swarms')
    });

    const first = store.append({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      eventType: 'swarm_activated',
      reason: 'cohort_escalation_detected',
      priority: 'high',
      lifecycle: 'activated',
      readiness: 'analyzing',
      linkedInvestigationIds: ['inv-2', 'inv-1'],
      linkedSynthesisIds: ['syn-1'],
      slotReference: 'daily:2026-03-11'
    });

    const second = store.append({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      eventType: 'swarm_activated',
      reason: 'cohort_escalation_detected',
      priority: 'high',
      lifecycle: 'activated',
      readiness: 'analyzing',
      linkedInvestigationIds: ['inv-1', 'inv-2'],
      linkedSynthesisIds: ['syn-1'],
      slotReference: 'daily:2026-03-11'
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(store.load('defi-risk-team').entries.length).toBe(1);
    expect(store.load('defi-risk-team').entries[0]?.linkedInvestigationIds).toEqual(['inv-1', 'inv-2']);
  });

  it('T-TS-H2 dedupe key remains stable for repeated payload', () => {
    const input = {
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      eventType: 'swarm_completed' as const,
      reason: 'swarm_completion_requirements_satisfied',
      priority: 'normal' as const,
      lifecycle: 'completed' as const,
      readiness: 'coherent' as const,
      linkedInvestigationIds: ['inv-1'],
      linkedSynthesisIds: ['syn-1'],
      slotReference: 'daily:2026-03-12'
    };

    expect(computeTeamSwarmEventDedupeKey(input)).toBe(computeTeamSwarmEventDedupeKey(input));
  });
});
