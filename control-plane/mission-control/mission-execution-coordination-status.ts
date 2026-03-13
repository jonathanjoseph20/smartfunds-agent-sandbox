import { uniqueSortedStrings } from './mission-execution-coordination-identity.ts';
import type {
  ExecutionFeedbackLink,
  ExecutionRequestRecord,
  MissionExecutionCoordinationStatusRecord,
} from './mission-execution-coordination-types.ts';

export function deriveMissionExecutionCoordinationStatus(input: {
  missionExecutionCoordinationPlanId: string;
  requests: ExecutionRequestRecord[];
  feedbackLinks: ExecutionFeedbackLink[];
}): MissionExecutionCoordinationStatusRecord {
  const states = input.requests.map((entry) => entry.state);
  const feedbackClasses = input.feedbackLinks.map((entry) => entry.feedbackClass);

  let status: MissionExecutionCoordinationStatusRecord['status'] = 'not_started';

  if (states.some((entry) => entry === 'inconclusive') || feedbackClasses.includes('execution_inconclusive')) {
    status = 'inconclusive';
  } else if (states.some((entry) => entry === 'failed') || feedbackClasses.includes('execution_failed') || feedbackClasses.includes('execution_blocked')) {
    status = 'execution_failed';
  } else if (states.some((entry) => entry === 'deferred')) {
    status = 'execution_deferred';
  } else if (states.length > 0 && states.every((entry) => entry === 'completed')) {
    status = 'execution_completed';
  } else if (
    states.some((entry) => entry === 'active' || entry === 'submitted')
    || feedbackClasses.includes('execution_started')
    || feedbackClasses.includes('execution_retrying')
  ) {
    status = 'execution_active';
  } else if (states.some((entry) => entry === 'queued' || entry === 'created')) {
    status = 'pending_execution';
  }

  return {
    missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
    status,
    reasonTokens: uniqueSortedStrings([
      `request_count:${String(input.requests.length)}`,
      `feedback_count:${String(input.feedbackLinks.length)}`,
      `status:${status}`,
    ]),
  };
}
