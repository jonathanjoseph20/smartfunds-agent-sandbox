import { derivePortfolioBlockingClusterId } from './mission-portfolio-identity.ts';
import type {
  PortfolioBlockingCluster,
  PortfolioBlockingClusterSeverity,
} from './mission-portfolio-types.ts';

export interface MissionPortfolioBlockingSignal {
  missionRunId: string;
  coordinationState: string;
  governanceStatus: string;
  priority: string;
  blockingMissionRunIds: string[];
  reasonTokens: string[];
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function severityForCluster(input: {
  blockerPriorities: string[];
  blockedCount: number;
  includesGovernanceBlock: boolean;
}): PortfolioBlockingClusterSeverity {
  if (input.includesGovernanceBlock || input.blockerPriorities.includes('critical')) {
    return 'critical';
  }
  if (input.blockedCount >= 3 || input.blockerPriorities.includes('high')) {
    return 'high';
  }
  if (input.blockedCount >= 2) {
    return 'medium';
  }
  return 'low';
}

export function deriveMissionPortfolioBlockingClusters(input: {
  missionPortfolioId: string;
  signals: MissionPortfolioBlockingSignal[];
}): PortfolioBlockingCluster[] {
  const blockedSignals = input.signals.filter((signal) => {
    return signal.coordinationState === 'blocked_by_dependency'
      || signal.coordinationState === 'blocked_by_escalation'
      || signal.governanceStatus === 'rejected'
      || signal.blockingMissionRunIds.length > 0;
  });

  const clusterByBlocker = new Map<string, {
    blockingMissionRunIds: Set<string>;
    blockedMissionRunIds: Set<string>;
    reasonTokens: Set<string>;
    blockerPriorities: Set<string>;
    includesGovernanceBlock: boolean;
  }>();

  for (const signal of blockedSignals) {
    if (signal.blockingMissionRunIds.length === 0 && signal.governanceStatus === 'rejected') {
      const key = `governance:${signal.missionRunId}`;
      const current = clusterByBlocker.get(key) ?? {
        blockingMissionRunIds: new Set<string>([signal.missionRunId]),
        blockedMissionRunIds: new Set<string>([signal.missionRunId]),
        reasonTokens: new Set<string>(),
        blockerPriorities: new Set<string>([signal.priority]),
        includesGovernanceBlock: true,
      };
      current.reasonTokens.add('governance_decision_blocked');
      for (const token of signal.reasonTokens) {
        current.reasonTokens.add(token);
      }
      clusterByBlocker.set(key, current);
      continue;
    }

    for (const blockerId of uniqueSorted(signal.blockingMissionRunIds)) {
      const current = clusterByBlocker.get(blockerId) ?? {
        blockingMissionRunIds: new Set<string>(),
        blockedMissionRunIds: new Set<string>(),
        reasonTokens: new Set<string>(),
        blockerPriorities: new Set<string>(),
        includesGovernanceBlock: false,
      };

      current.blockingMissionRunIds.add(blockerId);
      current.blockedMissionRunIds.add(signal.missionRunId);
      current.blockerPriorities.add(signal.priority);
      for (const token of signal.reasonTokens) {
        current.reasonTokens.add(token);
      }
      if (signal.coordinationState === 'blocked_by_escalation') {
        current.reasonTokens.add('escalation_blocked_dependency_chain');
      }

      clusterByBlocker.set(blockerId, current);
    }
  }

  return Array.from(clusterByBlocker.entries())
    .map(([blockerKey, cluster]): PortfolioBlockingCluster => {
      const blockingMissionRunIds = uniqueSorted(Array.from(cluster.blockingMissionRunIds));
      const blockedMissionRunIds = uniqueSorted(Array.from(cluster.blockedMissionRunIds));
      const reasonTokens = uniqueSorted(Array.from(cluster.reasonTokens));
      const severity = severityForCluster({
        blockerPriorities: Array.from(cluster.blockerPriorities),
        blockedCount: blockedMissionRunIds.length,
        includesGovernanceBlock: cluster.includesGovernanceBlock,
      });

      const portfolioBlockingClusterId = derivePortfolioBlockingClusterId({
        missionPortfolioId: input.missionPortfolioId,
        blockingMissionRunIds,
        blockedMissionRunIds,
        reasonTokens: [blockerKey, ...reasonTokens],
      });

      return {
        portfolioBlockingClusterId,
        missionPortfolioId: input.missionPortfolioId,
        blockingMissionRunIds,
        blockedMissionRunIds,
        reasonTokens,
        severity,
        state: blockedMissionRunIds.length > 0 ? 'active' : 'resolved',
      };
    })
    .sort((left, right) => left.portfolioBlockingClusterId.localeCompare(right.portfolioBlockingClusterId));
}
