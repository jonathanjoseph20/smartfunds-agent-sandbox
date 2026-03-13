import type { MissionPortfolioHealthState } from './mission-portfolio-types.ts';

export interface MissionPortfolioHealthSignal {
  missionRunId: string;
  operationalState: string;
  completionState: string;
  healthState: string;
}

export function deriveMissionPortfolioHealthState(input: {
  signals: MissionPortfolioHealthSignal[];
  blockingClusterCount: number;
}): MissionPortfolioHealthState {
  const total = input.signals.length;
  if (total === 0) {
    return 'inconclusive';
  }

  const failedCount = input.signals.filter((signal) => signal.completionState === 'failed' || signal.healthState === 'failed').length;
  const blockedCount = input.signals.filter((signal) => signal.operationalState === 'blocked' || signal.healthState === 'blocked').length;
  const unstableCount = input.signals.filter((signal) => signal.healthState === 'unstable').length;
  const degradedCount = input.signals.filter((signal) => signal.healthState === 'degraded' || signal.operationalState === 'degraded').length;
  const healthyCount = input.signals.filter((signal) => signal.healthState === 'healthy').length;
  const inconclusiveCount = input.signals.filter((signal) => signal.healthState === 'inconclusive').length;

  if (failedCount >= 2 || failedCount >= Math.ceil(total * 0.4)) {
    return 'failed';
  }

  if (input.blockingClusterCount > 0 || blockedCount >= Math.max(1, Math.ceil(total * 0.3))) {
    return 'blocked';
  }

  if (unstableCount >= Math.max(1, Math.ceil(total * 0.4))) {
    return 'unstable';
  }

  if (degradedCount > 0) {
    return 'degraded';
  }

  if (healthyCount === total) {
    return 'healthy';
  }

  if (inconclusiveCount > 0) {
    return 'inconclusive';
  }

  return 'unstable';
}
