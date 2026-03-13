import { uniqueSortedStrings } from './mission-execution-coordination-identity.ts';
import type {
  ExecutionFeedbackLink,
  ExecutionRequestRecord,
  MissionExecutionCoordinationOutcomeRecord,
  MissionExecutionCoordinationStatusRecord,
} from './mission-execution-coordination-types.ts';

export function deriveMissionExecutionCoordinationOutcome(input: {
  missionExecutionCoordinationPlanId: string;
  status: MissionExecutionCoordinationStatusRecord;
  requests: ExecutionRequestRecord[];
  feedbackLinks: ExecutionFeedbackLink[];
}): MissionExecutionCoordinationOutcomeRecord {
  let outcome: MissionExecutionCoordinationOutcomeRecord['outcome'] = 'pending';

  if (input.status.status === 'inconclusive') {
    outcome = 'inconclusive';
  } else if (input.status.status === 'execution_failed') {
    outcome = 'failed';
  } else if (input.status.status === 'execution_deferred') {
    outcome = 'deferred';
  } else if (input.status.status === 'execution_active') {
    outcome = 'active';
  } else if (input.status.status === 'execution_completed') {
    const total = input.requests.length;
    const completed = input.requests.filter((entry) => entry.state === 'completed').length;
    outcome = total > 0 && completed < total ? 'partially_completed' : 'completed';
  } else if (input.requests.some((entry) => entry.state === 'completed')) {
    outcome = 'partially_completed';
  }

  if (input.feedbackLinks.some((entry) => entry.feedbackClass === 'execution_inconclusive')) {
    outcome = 'inconclusive';
  }

  return {
    missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
    outcome,
    reasonTokens: uniqueSortedStrings([
      `status:${input.status.status}`,
      `outcome:${outcome}`,
      `completed_request_count:${String(input.requests.filter((entry) => entry.state === 'completed').length)}`,
      `feedback_count:${String(input.feedbackLinks.length)}`,
    ]),
  };
}
