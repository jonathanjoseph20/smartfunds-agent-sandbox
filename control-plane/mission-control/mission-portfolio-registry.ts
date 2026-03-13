import { deriveMissionPortfolioId } from './mission-portfolio-identity.ts';
import type {
  MissionPortfolioDefinition,
  MissionPortfolioType,
} from './mission-portfolio-types.ts';

export function createMissionPortfolioRegistry(options: {
  scopeKey?: string;
} = {}) {
  const scopeKey = options.scopeKey ?? 'mission-control';

  function buildDefinition(input: {
    portfolioType: MissionPortfolioType;
    displayName: string;
  }): MissionPortfolioDefinition {
    return {
      missionPortfolioId: deriveMissionPortfolioId({
        portfolioType: input.portfolioType,
        scopeKey,
      }),
      displayName: input.displayName,
      portfolioType: input.portfolioType,
    };
  }

  const definitions: MissionPortfolioDefinition[] = [
    buildDefinition({ portfolioType: 'objective_portfolio', displayName: 'Mission Objective Portfolio' }),
    buildDefinition({ portfolioType: 'coordination_portfolio', displayName: 'Mission Coordination Portfolio' }),
    buildDefinition({ portfolioType: 'dependency_cluster_portfolio', displayName: 'Mission Dependency Cluster Portfolio' }),
    buildDefinition({ portfolioType: 'governance_track_portfolio', displayName: 'Mission Governance Track Portfolio' }),
    buildDefinition({ portfolioType: 'operating_domain_portfolio', displayName: 'Mission Operating Domain Portfolio' }),
  ].sort((left, right) => left.missionPortfolioId.localeCompare(right.missionPortfolioId));

  const byId = new Map(definitions.map((entry) => [entry.missionPortfolioId, entry]));

  function listMissionPortfolios(): MissionPortfolioDefinition[] {
    return [...definitions];
  }

  function getMissionPortfolio(input: { missionPortfolioId: string }): MissionPortfolioDefinition {
    const found = byId.get(input.missionPortfolioId);
    if (!found) {
      throw new Error(`MISSION_PORTFOLIO_NOT_FOUND: ${input.missionPortfolioId}`);
    }
    return found;
  }

  return {
    listMissionPortfolios,
    getMissionPortfolio,
  };
}

export type MissionPortfolioRegistry = ReturnType<typeof createMissionPortfolioRegistry>;
