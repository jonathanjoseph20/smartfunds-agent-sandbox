import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTeamInspection } from '../../teams/team-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-team-registry-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('team registry integration', () => {
  it('T-TRI1 load, inspect, materialize, and preserve deterministic consistency', () => {
    const inspection = createTeamInspection({ artifactsRoot: path.join(tmpRoot, 'artifacts', 'teams') });

    const listed = inspection.listTeams();
    expect(listed.length).toBeGreaterThanOrEqual(7);

    const teamId = 'venture-opportunity-team';
    const projection = inspection.inspectTeam(teamId);
    const status = inspection.getTeamStatus(teamId);
    const history = inspection.getTeamHistory(teamId);

    expect(projection.teamId).toBe(teamId);
    expect(status.teamId).toBe(teamId);
    expect(history.teamId).toBe(teamId);

    const firstMaterialized = inspection.materializeTeam(teamId);
    const firstStatus = fs.readFileSync(firstMaterialized.statusPath, 'utf8');
    const firstHistory = fs.readFileSync(firstMaterialized.historyPath, 'utf8');

    const secondMaterialized = inspection.materializeTeam(teamId);
    const secondStatus = fs.readFileSync(secondMaterialized.statusPath, 'utf8');
    const secondHistory = fs.readFileSync(secondMaterialized.historyPath, 'utf8');

    expect(secondStatus).toBe(firstStatus);
    expect(secondHistory).toBe(firstHistory);
  });
});
