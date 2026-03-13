import type { MissionPortfolioReadinessState } from './mission-portfolio-types.ts';

export interface MissionPortfolioReadinessSignal {
  missionRunId: string;
  priority: string;
  operationalState: string;
  completionState: string;
  healthState: string;
  coordinationState: string;
  governanceStatus: string;
  hasBlockingDependencies: boolean;
}

function asReady(signal: MissionPortfolioReadinessSignal): boolean {
  if (signal.governanceStatus === 'rejected' || signal.governanceStatus === 'deferred' || signal.governanceStatus === 'awaiting_review') {
    return false;
  }

  if (signal.coordinationState === 'completed' || signal.completionState === 'completed') {
    return true;
  }

  return signal.coordinationState === 'active'
    || signal.coordinationState === 'ready_to_resume';
}

function asBlocked(signal: MissionPortfolioReadinessSignal): boolean {
  return signal.coordinationState === 'blocked_by_dependency'
    || signal.coordinationState === 'blocked_by_escalation'
    || signal.operationalState === 'blocked'
    || signal.governanceStatus === 'rejected'
    || signal.hasBlockingDependencies;
}

function asDegraded(signal: MissionPortfolioReadinessSignal): boolean {
  return signal.operationalState === 'degraded'
    || signal.healthState === 'degraded'
    || signal.healthState === 'failed';
}

function asInconclusive(signal: MissionPortfolioReadinessSignal): boolean {
  return signal.operationalState === 'inconclusive'
    || signal.healthState === 'inconclusive'
    || signal.governanceStatus === 'inconclusive';
}

export function deriveMissionPortfolioReadinessState(input: {
  signals: MissionPortfolioReadinessSignal[];
}): MissionPortfolioReadinessState {
  const total = input.signals.length;
  if (total === 0) {
    return 'inconclusive';
  }

  const blocked = input.signals.filter((signal) => asBlocked(signal));
  const degraded = input.signals.filter((signal) => asDegraded(signal));
  const ready = input.signals.filter((signal) => asReady(signal));
  const inconclusive = input.signals.filter((signal) => asInconclusive(signal));

  const criticalBlocked = blocked.some((signal) => signal.priority === 'critical');
  if (criticalBlocked || blocked.length >= Math.max(2, Math.ceil(total * 0.4))) {
    return 'blocked';
  }

  if (degraded.length >= Math.max(2, Math.ceil(total * 0.5))) {
    return 'degraded';
  }

  if (ready.length >= Math.ceil(total * 0.6) && blocked.length === 0 && inconclusive.length === 0) {
    return 'ready';
  }

  if (inconclusive.length === total) {
    return 'inconclusive';
  }

  if (ready.length > 0 && ready.length < total) {
    return 'partially_ready';
  }

  return 'not_ready';
}
