import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeMissionAssignmentEventDedupeKey,
  computeMissionAssignmentResolutionDedupeKey,
  createMissionAssignmentHistoryStore,
} from '../../mission-assignment/mission-assignment-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-assignment-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission assignment history store', () => {
  it('T-MA-H1 append-only behavior and dedupe are deterministic', () => {
    const store = createMissionAssignmentHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      assignmentDecisionId: 'decision-1',
      missionId: 'mission-1',
      eventType: 'assignment_evaluated',
      reasoning: 'evaluated',
      payload: { selectedTeamId: 'team-a' },
    });

    const second = store.append({
      assignmentDecisionId: 'decision-1',
      missionId: 'mission-1',
      eventType: 'assignment_evaluated',
      reasoning: 'evaluated',
      payload: { selectedTeamId: 'team-a' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MA-H2 ordering and repeated loads are stable', () => {
    const store = createMissionAssignmentHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      assignmentDecisionId: 'decision-1',
      missionId: 'mission-1',
      eventType: 'assignment_recommended',
      reasoning: 'recommended',
      payload: { selectedTeamId: 'team-a' },
    });

    store.append({
      assignmentDecisionId: 'decision-1',
      missionId: 'mission-1',
      eventType: 'assignment_materialized',
      reasoning: 'materialized',
      payload: { selectedTeamId: 'team-a' },
    });

    const first = store.load({ assignmentDecisionId: 'decision-1', missionId: 'mission-1' });
    const second = store.load({ assignmentDecisionId: 'decision-1', missionId: 'mission-1' });

    expect(first).toEqual(second);
    expect([...first.entries].sort((left, right) => left.eventDedupeKey.localeCompare(right.eventDedupeKey))).toEqual(first.entries);
  });

  it('T-MA-H3 event dedupe key is deterministic', () => {
    const input = {
      assignmentDecisionId: 'decision-1',
      missionId: 'mission-1',
      eventType: 'assignment_overridden' as const,
      reasoning: 'override',
      payload: { selectedTeamId: 'team-b' },
    };

    expect(computeMissionAssignmentEventDedupeKey(input)).toBe(computeMissionAssignmentEventDedupeKey(input));
  });

  it('T-MA-H4 does not mutate mission/team/compatibility source files', () => {
    const sourceFile = path.join(tmpRoot, 'source.json');
    fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
    fs.writeFileSync(sourceFile, '{"value":1}\n', 'utf8');

    const before = fs.readFileSync(sourceFile, 'utf8');

    const store = createMissionAssignmentHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });
    store.append({
      assignmentDecisionId: 'decision-1',
      missionId: 'mission-1',
      eventType: 'assignment_evaluated',
      reasoning: 'evaluated',
      payload: { selectedTeamId: 'team-a' },
    });

    const after = fs.readFileSync(sourceFile, 'utf8');
    expect(after).toBe(before);
  });

  it('T-MA-H5 mission resolution log resolves the latest assignment record by append order', () => {
    const store = createMissionAssignmentHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.appendMissionResolution({
      missionId: 'mission-1',
      assignmentDecisionId: 'decision-1',
      assignmentPolicyId: 'single-best-candidate',
      selectedTeamId: 'team-a',
      founderOverride: { applied: false },
      resolutionType: 'confirmed',
      reasoning: 'confirmed',
    });

    store.appendMissionResolution({
      missionId: 'mission-1',
      assignmentDecisionId: 'decision-2',
      assignmentPolicyId: 'single-best-candidate',
      selectedTeamId: 'team-b',
      founderOverride: {
        applied: true,
        selectedTeamId: 'team-b',
        reason: 'override',
        reviewedBy: 'founder',
      },
      resolutionType: 'overridden',
      reasoning: 'overridden',
    });

    const current = store.getCurrentMissionResolution('mission-1');
    expect(current?.assignmentDecisionId).toBe('decision-2');
    expect(current?.selectedTeamId).toBe('team-b');
    expect(current?.founderOverride.applied).toBe(true);
  });

  it('T-MA-H6 mission resolution prefers the latest override over later non-override entries', () => {
    const store = createMissionAssignmentHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.appendMissionResolution({
      missionId: 'mission-1',
      assignmentDecisionId: 'decision-1',
      assignmentPolicyId: 'single-best-candidate',
      selectedTeamId: 'team-a',
      founderOverride: { applied: false },
      resolutionType: 'confirmed',
      reasoning: 'confirmed',
    });

    store.appendMissionResolution({
      missionId: 'mission-1',
      assignmentDecisionId: 'decision-2',
      assignmentPolicyId: 'single-best-candidate',
      selectedTeamId: 'team-b',
      founderOverride: {
        applied: true,
        selectedTeamId: 'team-b',
        reason: 'override',
        reviewedBy: 'founder',
      },
      resolutionType: 'overridden',
      reasoning: 'overridden',
    });

    store.appendMissionResolution({
      missionId: 'mission-1',
      assignmentDecisionId: 'decision-3',
      assignmentPolicyId: 'single-best-candidate',
      selectedTeamId: 'team-a',
      founderOverride: { applied: false },
      resolutionType: 'evaluated',
      reasoning: 're-evaluated',
    });

    const current = store.getCurrentMissionResolution('mission-1');
    expect(current?.assignmentDecisionId).toBe('decision-2');
    expect(current?.selectedTeamId).toBe('team-b');
    expect(current?.founderOverride.applied).toBe(true);
  });

  it('T-MA-H7 mission resolution dedupe key is deterministic', () => {
    const input = {
      missionId: 'mission-1',
      assignmentDecisionId: 'decision-2',
      assignmentPolicyId: 'single-best-candidate',
      selectedTeamId: 'team-b',
      founderOverride: {
        applied: true,
        selectedTeamId: 'team-b',
        reason: 'override',
      },
      resolutionType: 'overridden' as const,
      reasoning: 'overridden',
    };

    expect(computeMissionAssignmentResolutionDedupeKey(input)).toBe(
      computeMissionAssignmentResolutionDedupeKey(input),
    );
  });
});
