import type { EngineeringPlanValidation } from '../engineering/engineering-plan-types.ts';

import type { ImplementationTaskGraphStatus } from './task-graph-status.ts';

export type ImplementationTaskGraphNode = {
  taskNodeId: string;
  taskGraphId: string;
  planId: string;
  taskType: 'implementation_phase' | 'plan_completion';
  taskName: string;
  taskDescription: string;
  taskInputs: Record<string, unknown>;
  requiredCapabilities: string[];
};

export type ImplementationTaskGraphEdge = {
  taskEdgeId: string;
  taskGraphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  dependencyType: 'finish_to_start';
};

export type ImplementationTaskGraph = {
  taskGraphId: string;
  planId: string;
  specId: string;
  taskNodes: ImplementationTaskGraphNode[];
  taskEdges: ImplementationTaskGraphEdge[];
  nodeCount: number;
  edgeCount: number;
  limitations: string[];
  provenanceInputs: {
    architectureSummary: string;
    implementationPhases: string[];
    subsystems: string[];
    dependencies: string[];
    integrationRequirements: string[];
    testStrategy: string;
    constraints: string[];
  };
};

export type ImplementationTaskGraphHistoryEvent = {
  eventType: 'implementation_task_graph_created' | 'implementation_task_graph_materialized';
  taskGraphId: string;
  payloadHash: string;
};

export type ImplementationTaskGraphValidation = {
  validationState: 'valid' | 'invalid';
  constraintViolations: string[];
};

export type ImplementationTaskGraphProjection = {
  taskGraphId: string;
  planId: string;
  specId: string;
  status: ImplementationTaskGraphStatus;
  nodeCount: number;
  edgeCount: number;
  planValidationState: EngineeringPlanValidation['validationState'];
  planMissingFields: string[];
  planConstraintViolations: string[];
  graphConstraintViolations: string[];
  historySummary: {
    totalEvents: number;
    lastEventType?: ImplementationTaskGraphHistoryEvent['eventType'];
  };
  artifactPaths: {
    dirPath: string;
    graphPath: string;
    statusPath: string;
    historyPath: string;
    reportPath: string;
    nodesPath: string;
    edgesPath: string;
  };
};

export type ImplementationTaskGraphMaterializationSummary = {
  taskGraphId: string;
  planId: string;
  specId: string;
  graphPath: string;
  statusPath: string;
  historyPath: string;
  reportPath: string;
  nodesPath: string;
  edgesPath: string;
};
