import type {
  EngineeringPlanValidation,
} from '../engineering/engineering-plan-types.ts';

import type {
  ImplementationTaskGraphHistoryEvent,
} from './task-graph-types.ts';

export const ImplementationTaskGraphStatus = {
  INCOMPLETE: 'incomplete',
  BLOCKED: 'blocked',
  READY: 'ready',
  MATERIALIZED: 'materialized',
} as const;

export type ImplementationTaskGraphStatus = (
  typeof ImplementationTaskGraphStatus
)[keyof typeof ImplementationTaskGraphStatus];

function hasMaterializedEvent(events: ImplementationTaskGraphHistoryEvent[]): boolean {
  return events.some((event) => event.eventType === 'implementation_task_graph_materialized');
}

export function deriveImplementationTaskGraphStatus(input: {
  planValidation: EngineeringPlanValidation;
  historyEvents: ImplementationTaskGraphHistoryEvent[];
}): ImplementationTaskGraphStatus {
  if (input.planValidation.missingFields.length > 0 || input.planValidation.validationState === 'incomplete') {
    return ImplementationTaskGraphStatus.INCOMPLETE;
  }

  if (input.planValidation.constraintViolations.length > 0 || input.planValidation.validationState === 'invalid') {
    return ImplementationTaskGraphStatus.BLOCKED;
  }

  if (hasMaterializedEvent(input.historyEvents)) {
    return ImplementationTaskGraphStatus.MATERIALIZED;
  }

  return ImplementationTaskGraphStatus.READY;
}
