import { describe, expect, it } from 'vitest';

import { listCohorts } from '../../cohorts/cohort-registry.ts';
import { loadInvestigationDefinitions } from '../../investigations/investigation-registry.ts';
import { listResearchTeams } from '../../research-teams/research-team-registry.ts';

describe('swarm regression smoke checks', () => {
  it('T-SW-RG1 existing investigation/cohort/team registries remain available', () => {
    const investigations = loadInvestigationDefinitions().map((entry) => entry.investigationDefinitionId);
    const cohorts = listCohorts().map((entry) => entry.cohortId);
    const teams = listResearchTeams().map((entry) => entry.teamId);

    expect(investigations).toContain('protocol-risk-investigation');
    expect(investigations).toContain('liquidity-drain-investigation');
    expect(cohorts.length).toBeGreaterThan(0);
    expect(teams).toContain('defi-risk-team');
  });
});
