import type {
  CrossPortfolioMissionIntelligenceProjection,
  SystemicBlockingClusterSeverity,
} from './cross-portfolio-mission-intelligence-types.ts';
import { uniqueSortedStrings } from './mission-control-orchestration-identity.ts';
import type {
  MissionControlOrchestrationPriority,
  MissionControlOrchestrationPriorityPosture,
} from './mission-control-orchestration-types.ts';

function severityRank(severity: SystemicBlockingClusterSeverity): number {
  if (severity === 'critical') {
    return 4;
  }
  if (severity === 'high') {
    return 3;
  }
  if (severity === 'medium') {
    return 2;
  }
  return 1;
}

function highestSeverity(values: SystemicBlockingClusterSeverity[]): SystemicBlockingClusterSeverity | 'none' {
  if (values.length === 0) {
    return 'none';
  }

  return [...values].sort((left, right) => severityRank(right) - severityRank(left))[0] ?? 'none';
}

export function deriveMissionControlOrchestrationPriority(input: {
  projection: CrossPortfolioMissionIntelligenceProjection;
}): MissionControlOrchestrationPriorityPosture {
  const highestBlockingSeverity = highestSeverity(input.projection.systemicBlockingClusters.map((entry) => entry.severity));
  const highestEscalationSeverity = highestSeverity(input.projection.escalationPatterns.map((entry) => entry.severity));

  let priority: MissionControlOrchestrationPriority = 'normal';

  if (
    input.projection.systemicRiskPosture === 'blocked'
    || input.projection.systemicRiskPosture === 'critical'
    || input.projection.readinessPosture === 'blocked'
    || highestBlockingSeverity === 'critical'
    || highestEscalationSeverity === 'critical'
  ) {
    priority = 'critical';
  } else if (
    input.projection.systemicRiskPosture === 'unstable'
    || input.projection.readinessPosture === 'degraded'
    || highestBlockingSeverity === 'high'
    || highestEscalationSeverity === 'high'
  ) {
    priority = 'high';
  } else if (
    input.projection.systemicRiskPosture === 'degraded'
    || input.projection.readinessPosture === 'partially_ready'
    || highestBlockingSeverity === 'medium'
    || highestEscalationSeverity === 'medium'
  ) {
    priority = 'normal';
  } else if (
    input.projection.intelligenceOutcome === 'watch'
    || highestBlockingSeverity === 'low'
    || highestEscalationSeverity === 'low'
  ) {
    priority = 'low';
  }

  if (
    input.projection.intelligenceOutcome === 'clear'
    && input.projection.systemicRiskPosture === 'clear'
    && input.projection.readinessPosture === 'ready'
  ) {
    priority = 'deferred';
  }

  return {
    missionControlInterventionPlanId: '',
    priority,
    systemicRiskPosture: input.projection.systemicRiskPosture,
    readinessPosture: input.projection.readinessPosture,
    highestBlockingSeverity,
    highestEscalationSeverity,
    reasonTokens: uniqueSortedStrings([
      `risk_posture:${input.projection.systemicRiskPosture}`,
      `readiness_posture:${input.projection.readinessPosture}`,
      `intelligence_outcome:${input.projection.intelligenceOutcome}`,
      `highest_blocking_severity:${highestBlockingSeverity}`,
      `highest_escalation_severity:${highestEscalationSeverity}`,
      `priority:${priority}`,
    ]),
  };
}
