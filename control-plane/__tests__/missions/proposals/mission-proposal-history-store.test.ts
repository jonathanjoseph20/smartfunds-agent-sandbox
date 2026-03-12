import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeMissionProposalEventDedupeKey,
  createMissionProposalHistoryStore,
} from '../../../missions/proposals/mission-proposal-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-proposal-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission proposal history store', () => {
  it('T-MP-H1 appends events and dedupes repeated writes', () => {
    const store = createMissionProposalHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-proposals'),
    });

    const first = store.append({
      proposalId: 'proposal-1',
      eventType: 'proposal_created',
      payload: { proposalType: 'market-memo-request' },
    });

    const second = store.append({
      proposalId: 'proposal-1',
      eventType: 'proposal_created',
      payload: { proposalType: 'market-memo-request' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(store.load('proposal-1').entries).toHaveLength(1);
  });

  it('T-MP-H2 keeps deterministic ordering', () => {
    const store = createMissionProposalHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-proposals'),
    });

    store.append({
      proposalId: 'proposal-1',
      eventType: 'proposal_submitted',
      payload: { state: 'submitted' },
    });

    store.append({
      proposalId: 'proposal-1',
      eventType: 'proposal_approved',
      payload: { state: 'approved' },
    });

    const loaded = store.load('proposal-1');
    expect(loaded.entries.map((entry) => entry.eventType)).toEqual(['proposal_approved', 'proposal_submitted']);
  });

  it('T-MP-H3 dedupe key is deterministic', () => {
    const input = {
      proposalId: 'proposal-1',
      eventType: 'proposal_conversion_attempted' as const,
      payload: { attempt: 1 },
    };

    expect(computeMissionProposalEventDedupeKey(input)).toBe(computeMissionProposalEventDedupeKey(input));
  });
});
