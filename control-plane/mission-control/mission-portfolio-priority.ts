import type { MissionPortfolioPriorityDistribution } from './mission-portfolio-types.ts';

export function deriveMissionPortfolioPriorityDistribution(input: {
  missionPriorities: string[];
}): MissionPortfolioPriorityDistribution {
  const counts: MissionPortfolioPriorityDistribution = {
    criticalMissionCount: 0,
    highMissionCount: 0,
    normalMissionCount: 0,
    lowMissionCount: 0,
    deferredMissionCount: 0,
    posture: 'priority_balanced',
  };

  for (const priority of input.missionPriorities) {
    if (priority === 'critical') {
      counts.criticalMissionCount += 1;
      continue;
    }
    if (priority === 'high') {
      counts.highMissionCount += 1;
      continue;
    }
    if (priority === 'normal') {
      counts.normalMissionCount += 1;
      continue;
    }
    if (priority === 'low') {
      counts.lowMissionCount += 1;
      continue;
    }
    counts.deferredMissionCount += 1;
  }

  const total = input.missionPriorities.length;
  if (total === 0) {
    counts.posture = 'priority_balanced';
    return counts;
  }

  if (counts.criticalMissionCount >= Math.max(2, Math.ceil(total * 0.4))) {
    counts.posture = 'critical_overload';
    return counts;
  }

  if (counts.deferredMissionCount >= Math.max(2, Math.ceil(total * 0.5))) {
    counts.posture = 'deferred_heavy';
    return counts;
  }

  const maxBand = Math.max(
    counts.criticalMissionCount,
    counts.highMissionCount,
    counts.normalMissionCount,
    counts.lowMissionCount,
    counts.deferredMissionCount,
  );

  counts.posture = maxBand > Math.ceil(total * 0.6)
    ? 'priority_skewed'
    : 'priority_balanced';

  return counts;
}
