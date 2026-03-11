import { describe, expect, it } from 'vitest';

import { listSwarmDefinitions } from '../../research-swarms/swarm-registry.ts';
import { listResearchTeams } from '../../research-teams/research-team-registry.ts';

describe('team swarm regression smoke checks', () => {
  it('T-TS-RG1 existing team/swarm registries remain available', () => {
    const teams = listResearchTeams().map((entry) => entry.teamId);
    const swarms = listSwarmDefinitions().map((entry) => entry.swarmId);

    expect(teams).toContain('defi-risk-team');
    expect(teams).toContain('governance-monitoring-team');
    expect(swarms).toContain('protocol-risk-response');
    expect(swarms).toContain('governance-anomaly-response');
  });
});
