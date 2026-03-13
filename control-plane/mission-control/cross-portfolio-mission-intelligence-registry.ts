import {
  deriveCrossPortfolioMissionIntelligenceSetId,
  uniqueSortedStrings,
} from './cross-portfolio-mission-intelligence-identity.ts';
import type {
  CrossPortfolioMissionIntelligenceSet,
  CrossPortfolioMissionIntelligenceSetType,
} from './cross-portfolio-mission-intelligence-types.ts';
import {
  CROSS_PORTFOLIO_MISSION_INTELLIGENCE_SET_TYPES,
} from './cross-portfolio-mission-intelligence-types.ts';

const DISPLAY_NAME_BY_SET_TYPE: Record<CrossPortfolioMissionIntelligenceSetType, string> = {
  systemic_blocking_set: 'Systemic Blocking Intelligence Set',
  shared_dependency_set: 'Shared Dependency Intelligence Set',
  governance_pattern_set: 'Governance Pattern Intelligence Set',
  resolution_regression_set: 'Resolution Regression Intelligence Set',
  mission_control_watch_set: 'Mission Control Watch Intelligence Set',
};

function dedupeById(sets: CrossPortfolioMissionIntelligenceSet[]): CrossPortfolioMissionIntelligenceSet[] {
  const byId = new Map<string, CrossPortfolioMissionIntelligenceSet>();
  for (const entry of sets) {
    byId.set(entry.crossPortfolioMissionIntelligenceSetId, entry);
  }
  return Array.from(byId.values())
    .sort((left, right) => left.crossPortfolioMissionIntelligenceSetId.localeCompare(right.crossPortfolioMissionIntelligenceSetId));
}

export function createCrossPortfolioMissionIntelligenceRegistry() {
  function normalizePortfolioMembership(input: { portfolioIds: string[] }): string[] {
    return uniqueSortedStrings(input.portfolioIds);
  }

  function validateIntelligenceSet(input: {
    setType: string;
    displayName: string;
    portfolioIds: string[];
  }): { setType: CrossPortfolioMissionIntelligenceSetType; displayName: string; portfolioIds: string[] } {
    const setType = input.setType as CrossPortfolioMissionIntelligenceSetType;
    if (!CROSS_PORTFOLIO_MISSION_INTELLIGENCE_SET_TYPES.includes(setType)) {
      throw new Error(`CROSS_PORTFOLIO_INTELLIGENCE_SET_TYPE_INVALID: ${input.setType}`);
    }

    const displayName = input.displayName.trim();
    if (displayName.length === 0) {
      throw new Error('CROSS_PORTFOLIO_INTELLIGENCE_SET_DISPLAY_NAME_INVALID');
    }

    const portfolioIds = normalizePortfolioMembership({ portfolioIds: input.portfolioIds });
    if (portfolioIds.length === 0) {
      throw new Error('CROSS_PORTFOLIO_INTELLIGENCE_SET_MEMBERSHIP_EMPTY');
    }

    return {
      setType,
      displayName,
      portfolioIds,
    };
  }

  function createIntelligenceSet(input: {
    setType: CrossPortfolioMissionIntelligenceSetType;
    portfolioIds: string[];
    displayName?: string;
  }): CrossPortfolioMissionIntelligenceSet {
    const validated = validateIntelligenceSet({
      setType: input.setType,
      displayName: input.displayName ?? DISPLAY_NAME_BY_SET_TYPE[input.setType],
      portfolioIds: input.portfolioIds,
    });

    return {
      crossPortfolioMissionIntelligenceSetId: deriveCrossPortfolioMissionIntelligenceSetId({
        setType: validated.setType,
        portfolioIds: validated.portfolioIds,
      }),
      displayName: validated.displayName,
      setType: validated.setType,
      portfolioIds: validated.portfolioIds,
      membershipSummary: {
        totalPortfolioCount: validated.portfolioIds.length,
        uniquePortfolioCount: validated.portfolioIds.length,
      },
      systemicRiskPosture: 'inconclusive',
      readinessPosture: 'inconclusive',
      sharedDependencyIds: [],
      systemicBlockingClusterIds: [],
      escalationPatternIds: [],
      intelligenceOutcome: 'inconclusive',
    };
  }

  function dedupeIntelligenceSets(input: {
    sets: Array<{
      setType: CrossPortfolioMissionIntelligenceSetType;
      portfolioIds: string[];
      displayName?: string;
    }>;
  }): CrossPortfolioMissionIntelligenceSet[] {
    return dedupeById(input.sets.map((entry) => createIntelligenceSet(entry)));
  }

  function listDefaultIntelligenceSets(input: { portfolioIds: string[] }): CrossPortfolioMissionIntelligenceSet[] {
    const portfolioIds = normalizePortfolioMembership({ portfolioIds: input.portfolioIds });
    if (portfolioIds.length === 0) {
      return [];
    }

    return dedupeIntelligenceSets({
      sets: CROSS_PORTFOLIO_MISSION_INTELLIGENCE_SET_TYPES.map((setType) => ({
        setType,
        portfolioIds,
      })),
    });
  }

  return {
    normalizePortfolioMembership,
    validateIntelligenceSet,
    createIntelligenceSet,
    dedupeIntelligenceSets,
    listDefaultIntelligenceSets,
  };
}

export type CrossPortfolioMissionIntelligenceRegistry = ReturnType<typeof createCrossPortfolioMissionIntelligenceRegistry>;
