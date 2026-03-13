import { deriveMissionPortfolioMembershipId } from './mission-portfolio-identity.ts';
import type {
  MissionPortfolioDefinition,
  MissionPortfolioMembership,
  MissionPortfolioMembershipClass,
  MissionPortfolioMembershipSummary,
} from './mission-portfolio-types.ts';

function uniqueSorted(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function createMembership(input: {
  missionPortfolioId: string;
  missionRunId: string;
  membershipClass: MissionPortfolioMembershipClass;
  reasonTokens: string[];
  state?: 'active' | 'inactive';
}): MissionPortfolioMembership {
  const reasonTokens = uniqueSorted(input.reasonTokens);
  const state = input.state ?? 'active';

  return {
    missionPortfolioMembershipId: deriveMissionPortfolioMembershipId({
      missionPortfolioId: input.missionPortfolioId,
      missionRunId: input.missionRunId,
      membershipClass: input.membershipClass,
      reasonTokens,
      state,
    }),
    missionPortfolioId: input.missionPortfolioId,
    missionRunId: input.missionRunId,
    membershipClass: input.membershipClass,
    reasonTokens,
    state,
  };
}

function classForPortfolioType(portfolioType: MissionPortfolioDefinition['portfolioType']): MissionPortfolioMembershipClass {
  if (portfolioType === 'objective_portfolio') {
    return 'shared_objective';
  }
  if (portfolioType === 'dependency_cluster_portfolio') {
    return 'shared_dependency_chain';
  }
  if (portfolioType === 'governance_track_portfolio') {
    return 'shared_governance_track';
  }
  if (portfolioType === 'operating_domain_portfolio') {
    return 'shared_operating_domain';
  }
  return 'explicit_portfolio_membership';
}

export function deriveMissionPortfolioMembership(input: {
  portfolio: MissionPortfolioDefinition;
  missionRunIds: string[];
  missionPriorities: Map<string, string>;
  blockedMissionRunIds: Set<string>;
  governanceImpactedMissionRunIds: Set<string>;
}): MissionPortfolioMembership[] {
  const classDefault = classForPortfolioType(input.portfolio.portfolioType);
  const memberships = new Map<string, MissionPortfolioMembership>();

  for (const missionRunId of uniqueSorted(input.missionRunIds)) {
    const reasonTokens = [`portfolio_type:${input.portfolio.portfolioType}`];
    let membershipClass = classDefault;

    if (input.portfolio.portfolioType === 'coordination_portfolio') {
      const priority = input.missionPriorities.get(missionRunId) ?? 'normal';
      membershipClass = 'shared_priority_band';
      reasonTokens.push(`priority:${priority}`);
      if (input.blockedMissionRunIds.has(missionRunId)) {
        reasonTokens.push('blocked_in_coordination_surface');
      }
    }

    if (input.portfolio.portfolioType === 'dependency_cluster_portfolio' && !input.blockedMissionRunIds.has(missionRunId)) {
      continue;
    }

    if (input.portfolio.portfolioType === 'governance_track_portfolio' && !input.governanceImpactedMissionRunIds.has(missionRunId)) {
      continue;
    }

    const membership = createMembership({
      missionPortfolioId: input.portfolio.missionPortfolioId,
      missionRunId,
      membershipClass,
      reasonTokens,
    });

    memberships.set(membership.missionPortfolioMembershipId, membership);
  }

  return Array.from(memberships.values()).sort((left, right) => {
    const runCompare = left.missionRunId.localeCompare(right.missionRunId);
    if (runCompare !== 0) {
      return runCompare;
    }

    const classCompare = left.membershipClass.localeCompare(right.membershipClass);
    if (classCompare !== 0) {
      return classCompare;
    }

    return left.missionPortfolioMembershipId.localeCompare(right.missionPortfolioMembershipId);
  });
}

export function summarizeMissionPortfolioMembership(input: {
  memberships: MissionPortfolioMembership[];
}): MissionPortfolioMembershipSummary {
  const counts: MissionPortfolioMembershipSummary['membershipClassCounts'] = {
    shared_objective: 0,
    shared_dependency_chain: 0,
    shared_governance_track: 0,
    shared_priority_band: 0,
    explicit_portfolio_membership: 0,
    shared_operating_domain: 0,
  };

  let activeMembershipCount = 0;

  for (const membership of input.memberships) {
    counts[membership.membershipClass] += 1;
    if (membership.state === 'active') {
      activeMembershipCount += 1;
    }
  }

  return {
    totalMembershipCount: input.memberships.length,
    activeMembershipCount,
    membershipClassCounts: counts,
  };
}
