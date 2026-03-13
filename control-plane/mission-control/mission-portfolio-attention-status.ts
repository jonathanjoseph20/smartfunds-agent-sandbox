import type {
  MissionPortfolioActionOutcome,
  MissionPortfolioAttentionQueueState,
  MissionPortfolioAttentionRequirement,
  MissionPortfolioAttentionStatus,
  MissionPortfolioEscalation,
} from './mission-portfolio-attention-types.ts';

export function deriveMissionPortfolioAttentionStatus(input: {
  actionOutcome: MissionPortfolioActionOutcome;
  queueState: MissionPortfolioAttentionQueueState | null;
  requirements: MissionPortfolioAttentionRequirement[];
  escalations: MissionPortfolioEscalation[];
}): MissionPortfolioAttentionStatus {
  if (input.actionOutcome === 'suppressed') {
    return 'suppressed';
  }

  if (input.actionOutcome === 'deferred') {
    return 'deferred';
  }

  if (input.actionOutcome === 'acknowledged') {
    return 'acknowledged';
  }

  if (input.actionOutcome === 'escalated' || input.escalations.some((entry) => entry.state === 'open')) {
    return 'escalated';
  }

  if (input.actionOutcome === 'inconclusive') {
    return 'inconclusive';
  }

  if (input.requirements.some((entry) => entry.state === 'inconclusive')) {
    return 'inconclusive';
  }

  if (input.requirements.length === 0) {
    return 'no_attention_required';
  }

  if (input.queueState === 'under_attention') {
    return 'under_attention';
  }

  if (input.queueState === 'deferred') {
    return 'deferred';
  }

  if (input.queueState === 'action_recorded') {
    return 'under_attention';
  }

  return 'awaiting_attention';
}
