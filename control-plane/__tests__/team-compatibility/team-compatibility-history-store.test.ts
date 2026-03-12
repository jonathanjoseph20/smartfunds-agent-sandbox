import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeTeamCompatibilityEventDedupeKey,
  createTeamCompatibilityHistoryStore,
} from '../../team-compatibility/team-compatibility-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-team-compatibility-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('team compatibility history store', () => {
  it('T-TC-H1 append-only behavior and dedupe are deterministic', () => {
    const store = createTeamCompatibilityHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      compatibilitySetId: 'set-1',
      missionId: 'mission-1',
      eventType: 'compatibility_evaluated',
      reasoning: 'reason',
      payload: { a: 1 },
    });

    const second = store.append({
      compatibilitySetId: 'set-1',
      missionId: 'mission-1',
      eventType: 'compatibility_evaluated',
      reasoning: 'reason',
      payload: { a: 1 },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-TC-H2 maintains stable ordering and idempotent repeated loads', () => {
    const store = createTeamCompatibilityHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      compatibilitySetId: 'set-1',
      missionId: 'mission-1',
      eventType: 'candidate_added',
      reasoning: 'add',
      payload: { teamId: 'b' },
    });

    store.append({
      compatibilitySetId: 'set-1',
      missionId: 'mission-1',
      eventType: 'candidate_removed',
      reasoning: 'remove',
      payload: { teamId: 'a' },
    });

    const first = store.load({ compatibilitySetId: 'set-1', missionId: 'mission-1' });
    const second = store.load({ compatibilitySetId: 'set-1', missionId: 'mission-1' });

    expect(first).toEqual(second);
    expect([...first.entries].sort((left, right) => left.eventDedupeKey.localeCompare(right.eventDedupeKey))).toEqual(first.entries);
  });

  it('T-TC-H3 dedupe key generation is deterministic', () => {
    const input = {
      compatibilitySetId: 'set-1',
      missionId: 'mission-1',
      eventType: 'compatibility_materialized' as const,
      reasoning: 'materialized',
      payload: { x: true },
    };

    expect(computeTeamCompatibilityEventDedupeKey(input)).toBe(computeTeamCompatibilityEventDedupeKey(input));
  });

  it('T-TC-H4 does not mutate mission or team source files', () => {
    const sourceFile = path.join(tmpRoot, 'source.json');
    fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
    fs.writeFileSync(sourceFile, '{"value":1}\n', 'utf8');
    const before = fs.readFileSync(sourceFile, 'utf8');

    const store = createTeamCompatibilityHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });
    store.append({
      compatibilitySetId: 'set-1',
      missionId: 'mission-1',
      eventType: 'compatibility_evaluated',
      reasoning: 'reason',
      payload: { a: 1 },
    });

    const after = fs.readFileSync(sourceFile, 'utf8');
    expect(after).toBe(before);
  });
});
