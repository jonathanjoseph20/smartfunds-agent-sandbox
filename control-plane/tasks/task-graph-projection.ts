import type { EngineeringPlanValidation } from '../engineering/engineering-plan-types.ts';

import {
  resolveImplementationTaskGraphArtifactPaths,
} from './task-graph-artifacts.ts';
import {
  deriveImplementationTaskGraphStatus,
} from './task-graph-status.ts';
import type {
  ImplementationTaskGraph,
  ImplementationTaskGraphHistoryEvent,
  ImplementationTaskGraphProjection,
  ImplementationTaskGraphValidation,
} from './task-graph-types.ts';

export function projectImplementationTaskGraph(input: {
  graph: ImplementationTaskGraph;
  planValidation: EngineeringPlanValidation;
  graphValidation: ImplementationTaskGraphValidation;
  historyEvents: ImplementationTaskGraphHistoryEvent[];
}): ImplementationTaskGraphProjection {
  const status = deriveImplementationTaskGraphStatus({
    planValidation: input.planValidation,
    historyEvents: input.historyEvents,
  });

  const historyEvents = [...input.historyEvents].sort((left, right) => {
    const byType = left.eventType.localeCompare(right.eventType);
    if (byType !== 0) {
      return byType;
    }

    return left.payloadHash.localeCompare(right.payloadHash);
  });

  return {
    taskGraphId: input.graph.taskGraphId,
    planId: input.graph.planId,
    specId: input.graph.specId,
    status,
    nodeCount: input.graph.nodeCount,
    edgeCount: input.graph.edgeCount,
    planValidationState: input.planValidation.validationState,
    planMissingFields: [...input.planValidation.missingFields].sort((left, right) => left.localeCompare(right)),
    planConstraintViolations: [...input.planValidation.constraintViolations].sort((left, right) => left.localeCompare(right)),
    graphConstraintViolations: [...input.graphValidation.constraintViolations].sort((left, right) => left.localeCompare(right)),
    historySummary: {
      totalEvents: historyEvents.length,
      ...(historyEvents[historyEvents.length - 1]
        ? { lastEventType: historyEvents[historyEvents.length - 1].eventType }
        : {}),
    },
    artifactPaths: resolveImplementationTaskGraphArtifactPaths({
      taskGraphId: input.graph.taskGraphId,
    }),
  };
}
