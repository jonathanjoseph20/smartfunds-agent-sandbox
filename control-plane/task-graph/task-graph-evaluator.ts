import {
  createExecutionEngineProjection,
  type ExecutionEngineProjectionEngine,
} from '../execution-engine/execution-engine-projection.ts';
import { canonicalStringify } from '../finance/determinism.ts';
import {
  createRuntimeEnvelopeProjection,
  type RuntimeEnvelopeProjectionEngine,
} from '../runtime-envelope/runtime-envelope-projection.ts';

import {
  deriveTaskEdgeId,
  deriveTaskGraphId,
  deriveTaskNodeId,
  normalizeTaskEdges,
  normalizeTaskGraphStructure,
  normalizeTaskNodes,
} from './task-graph-identity.ts';
import {
  createTaskGraphHistoryStore,
  type TaskGraphHistoryStore,
} from './task-graph-history-store.ts';
import { deriveTaskGraphStatus } from './task-graph-status.ts';
import type {
  MissionTaskEdge,
  MissionTaskGraph,
  MissionTaskNode,
  TaskEdgeDependencyType,
  TaskNodeEligibilityState,
  TaskNodeState,
} from './task-graph-types.ts';
import { validateTaskGraph } from './task-graph-validation.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeUnknownRecord(values: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(values)) as Record<string, unknown>;
}

interface DerivedNodeSeed {
  nodeKey: string;
  taskType: string;
  taskName: string;
  taskDescription: string;
  taskInputs: Record<string, unknown>;
  taskOutputs: Record<string, unknown>;
  requiredCapabilities: string[];
  provenanceInputs: Record<string, unknown>;
}

function deriveRequiredCapabilities(runtimeCapabilities: Record<string, boolean>): string[] {
  return Object.entries(runtimeCapabilities)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
}

function deriveNodeSeeds(input: {
  missionId: string;
  executionEngineRunId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  executionTarget: string;
  runMode: string;
  allowedActions: string[];
  requiredCapabilities: string[];
}): DerivedNodeSeed[] {
  const allowedActions = uniqueSorted(input.allowedActions);

  if (allowedActions.length === 0) {
    return [{
      nodeKey: 'execution_target_validation',
      taskType: 'execution_target_validation',
      taskName: 'Validate execution target envelope',
      taskDescription: 'Deterministic structural task derived when no authorized action list is present.',
      taskInputs: {
        missionId: input.missionId,
        executionTarget: input.executionTarget,
        runMode: input.runMode,
      },
      taskOutputs: {
        outputKind: 'execution_target_validated',
      },
      requiredCapabilities: input.requiredCapabilities,
      provenanceInputs: {
        derivationRule: 'fallback_single_validation_task',
      },
    }];
  }

  return allowedActions.map((action, index) => ({
    nodeKey: `authorized_action_${String(index).padStart(4, '0')}_${action}`,
    taskType: 'authorized_action',
    taskName: `Execute authorized action: ${action}`,
    taskDescription: `Deterministic structural task derived from execution contract authorized action ${action}.`,
    taskInputs: {
      missionId: input.missionId,
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      executionTarget: input.executionTarget,
      runMode: input.runMode,
      authorizedAction: action,
    },
    taskOutputs: {
      outputKind: `authorized_action_${action}`,
    },
    requiredCapabilities: input.requiredCapabilities,
    provenanceInputs: {
      derivationRule: 'authorized_actions_linearized_finish_to_start',
      authorizedAction: action,
      index,
    },
  }));
}

function deriveEdgeSeeds(nodes: DerivedNodeSeed[]): Array<{
  sourceNodeKey: string;
  targetNodeKey: string;
  dependencyType: TaskEdgeDependencyType;
}> {
  if (nodes.length < 2) {
    return [];
  }

  const edges: Array<{
    sourceNodeKey: string;
    targetNodeKey: string;
    dependencyType: TaskEdgeDependencyType;
  }> = [];

  for (let index = 1; index < nodes.length; index += 1) {
    edges.push({
      sourceNodeKey: nodes[index - 1]!.nodeKey,
      targetNodeKey: nodes[index]!.nodeKey,
      dependencyType: 'finish_to_start',
    });
  }

  return edges;
}

function applyInitialNodeState(input: {
  node: MissionTaskNode;
  finishToStartPredecessors: string[];
  graphBlocked: boolean;
  upstreamBlockingReasons: string[];
}): MissionTaskNode {
  let taskState: TaskNodeState = 'pending';
  let taskEligibilityState: TaskNodeEligibilityState = 'waiting_on_dependencies';
  const blockingReasons: string[] = [];

  if (input.graphBlocked) {
    taskState = 'blocked';
    taskEligibilityState = 'blocked';
    blockingReasons.push('execution_engine_blocked', ...input.upstreamBlockingReasons);
  } else if (input.finishToStartPredecessors.length === 0) {
    taskState = 'ready';
    taskEligibilityState = 'eligible';
  } else {
    taskState = 'pending';
    taskEligibilityState = 'waiting_on_dependencies';
    for (const predecessorId of input.finishToStartPredecessors.sort((left, right) => left.localeCompare(right))) {
      blockingReasons.push(`dependency_unsatisfied:${predecessorId}`);
    }
  }

  return {
    ...input.node,
    taskState,
    taskEligibilityState,
    blockingReasons: uniqueSorted(blockingReasons),
  };
}

export interface TaskGraphEvaluationResult {
  taskGraph: MissionTaskGraph;
}

export function createTaskGraphEvaluator(options: {
  executionEngineProjection?: ExecutionEngineProjectionEngine;
  runtimeEnvelopeProjection?: RuntimeEnvelopeProjectionEngine;
  historyStore?: TaskGraphHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
  executionAttemptArtifactsRoot?: string;
  executionJournalArtifactsRoot?: string;
  executionEngineArtifactsRoot?: string;
  taskGraphArtifactsRoot?: string;
} = {}) {
  const executionEngineProjection = options.executionEngineProjection ?? createExecutionEngineProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
  });

  const runtimeEnvelopeProjection = options.runtimeEnvelopeProjection ?? createRuntimeEnvelopeProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createTaskGraphHistoryStore({
    artifactsRoot: options.taskGraphArtifactsRoot,
  });

  function evaluateTaskGraph(input: { executionEngineRunId: string }): TaskGraphEvaluationResult {
    const executionEngineRun = executionEngineProjection.projectOne({
      executionEngineRunId: input.executionEngineRunId,
    });

    const runtimeEnvelope = runtimeEnvelopeProjection.projectOne({
      runtimeEnvelopeId: executionEngineRun.runtimeEnvelopeId,
    });

    const requiredCapabilities = deriveRequiredCapabilities(runtimeEnvelope.runtimeCapabilities as Record<string, boolean>);
    const nodeSeeds = deriveNodeSeeds({
      missionId: executionEngineRun.missionId,
      executionEngineRunId: executionEngineRun.executionEngineRunId,
      executionAttemptId: executionEngineRun.executionAttemptId,
      runtimeEnvelopeId: executionEngineRun.runtimeEnvelopeId,
      executionContractId: executionEngineRun.executionContractId,
      executionTarget: executionEngineRun.runInputs.executionTarget,
      runMode: executionEngineRun.runMode,
      allowedActions: executionEngineRun.runInputs.allowedActions,
      requiredCapabilities,
    });
    const edgeSeeds = deriveEdgeSeeds(nodeSeeds);

    const normalizedGraphStructure = normalizeTaskGraphStructure({
      nodes: nodeSeeds,
      edges: edgeSeeds,
    });

    const taskGraphId = deriveTaskGraphId({
      executionEngineRunId: executionEngineRun.executionEngineRunId,
      executionAttemptId: executionEngineRun.executionAttemptId,
      runtimeEnvelopeId: executionEngineRun.runtimeEnvelopeId,
      executionContractId: executionEngineRun.executionContractId,
      missionId: executionEngineRun.missionId,
      normalizedGraphStructure,
    });

    const nodesByKey = new Map<string, MissionTaskNode>();
    for (const seed of nodeSeeds) {
      const taskNodeId = deriveTaskNodeId({
        taskGraphId,
        taskType: seed.taskType,
        taskName: seed.taskName,
        taskInputs: seed.taskInputs,
      });

      nodesByKey.set(seed.nodeKey, {
        taskNodeId,
        taskGraphId,
        taskType: seed.taskType,
        taskName: seed.taskName,
        taskDescription: seed.taskDescription,
        taskInputs: normalizeUnknownRecord(seed.taskInputs),
        taskOutputs: normalizeUnknownRecord(seed.taskOutputs),
        requiredCapabilities: uniqueSorted(seed.requiredCapabilities),
        retryPolicy: {
          retryPolicyId: 'mission_task_retry_default_v1',
          maxRetries: 3,
          retryStrategy: 'immediate',
          retryDelayModel: 'deterministic_linear',
          retryConditions: ['RETRYABLE_FAILURE', 'SYSTEM_FAILURE'],
          baseDelay: 1,
        },
        taskState: 'pending',
        taskEligibilityState: 'waiting_on_dependencies',
        blockingReasons: [],
        limitations: uniqueSorted([
          'task_graph_structure_only_sprint_6_1',
          'task_graph_no_runtime_dispatch',
        ]),
        provenanceInputs: normalizeUnknownRecord({
          ...seed.provenanceInputs,
          source: 'task_graph_evaluator',
        }),
      });
    }

    const taskEdges: MissionTaskEdge[] = edgeSeeds.map((edgeSeed) => {
      const sourceNode = nodesByKey.get(edgeSeed.sourceNodeKey);
      const targetNode = nodesByKey.get(edgeSeed.targetNodeKey);
      if (!sourceNode || !targetNode) {
        throw new Error(`TASK_GRAPH_INVALID_EDGE_REFERENCE: ${edgeSeed.sourceNodeKey}->${edgeSeed.targetNodeKey}`);
      }

      return {
        taskEdgeId: deriveTaskEdgeId({
          taskGraphId,
          sourceNodeId: sourceNode.taskNodeId,
          targetNodeId: targetNode.taskNodeId,
          dependencyType: edgeSeed.dependencyType,
        }),
        taskGraphId,
        sourceNodeId: sourceNode.taskNodeId,
        targetNodeId: targetNode.taskNodeId,
        dependencyType: edgeSeed.dependencyType,
        edgeState: 'active',
      };
    });

    const finishToStartPredecessors = new Map<string, string[]>();
    for (const node of nodesByKey.values()) {
      finishToStartPredecessors.set(node.taskNodeId, []);
    }

    for (const edge of taskEdges) {
      if (edge.dependencyType !== 'finish_to_start') {
        continue;
      }
      const current = finishToStartPredecessors.get(edge.targetNodeId) ?? [];
      current.push(edge.sourceNodeId);
      current.sort((left, right) => left.localeCompare(right));
      finishToStartPredecessors.set(edge.targetNodeId, current);
    }

    const graphBlocked = executionEngineRun.engineState === 'blocked' || executionEngineRun.engineEligibilityState === 'blocked';

    const taskNodes = [...nodesByKey.values()]
      .map((node) => applyInitialNodeState({
        node,
        finishToStartPredecessors: finishToStartPredecessors.get(node.taskNodeId) ?? [],
        graphBlocked,
        upstreamBlockingReasons: executionEngineRun.blockingReasons,
      }));

    const normalizedTaskNodes = normalizeTaskNodes(taskNodes);
    const normalizedTaskEdges = normalizeTaskEdges(taskEdges);

    validateTaskGraph({
      taskGraphId,
      taskNodes: normalizedTaskNodes,
      taskEdges: normalizedTaskEdges,
    });

    const status = deriveTaskGraphStatus({
      taskNodes: normalizedTaskNodes,
    });

    const taskGraph: MissionTaskGraph = {
      taskGraphId,
      executionEngineRunId: executionEngineRun.executionEngineRunId,
      executionAttemptId: executionEngineRun.executionAttemptId,
      runtimeEnvelopeId: executionEngineRun.runtimeEnvelopeId,
      executionContractId: executionEngineRun.executionContractId,
      missionId: executionEngineRun.missionId,
      taskNodes: normalizedTaskNodes,
      taskEdges: normalizedTaskEdges,
      graphState: status.graphState,
      graphEligibilityState: status.graphEligibilityState,
      nodeCount: normalizedTaskNodes.length,
      edgeCount: normalizedTaskEdges.length,
      blockingReasons: uniqueSorted([
        ...status.blockingReasons,
        ...(graphBlocked ? executionEngineRun.blockingReasons : []),
      ]),
      limitations: uniqueSorted([
        'task_graph_structure_only_sprint_6_1',
        'task_graph_projection_first_truth',
        'task_graph_no_execution_dispatch',
        ...executionEngineRun.limitations,
      ]),
      provenanceInputs: {
        engineState: executionEngineRun.engineState,
        engineEligibilityState: executionEngineRun.engineEligibilityState,
        engineBlockingReasons: uniqueSorted(executionEngineRun.blockingReasons),
        engineLimitations: uniqueSorted(executionEngineRun.limitations),
        runtimeEnvelopeState: runtimeEnvelope.envelopeState,
        runtimeEnvelopeEligibility: runtimeEnvelope.envelopeEligibility,
        runtimeEnvelopeLimitations: uniqueSorted(runtimeEnvelope.limitations),
        runtimeEnvelopeBlockers: uniqueSorted(runtimeEnvelope.blockers),
      },
    };

    historyStore.append({
      taskGraphId,
      executionEngineRunId: taskGraph.executionEngineRunId,
      executionAttemptId: taskGraph.executionAttemptId,
      runtimeEnvelopeId: taskGraph.runtimeEnvelopeId,
      executionContractId: taskGraph.executionContractId,
      missionId: taskGraph.missionId,
      eventType: 'graph_initialized',
      reasoning: 'task_graph_initialized_from_execution_engine_projection',
      eventPayload: {
        taskGraphId,
        executionEngineRunId: taskGraph.executionEngineRunId,
        nodeCount: taskGraph.nodeCount,
        edgeCount: taskGraph.edgeCount,
      },
    });

    historyStore.append({
      taskGraphId,
      executionEngineRunId: taskGraph.executionEngineRunId,
      executionAttemptId: taskGraph.executionAttemptId,
      runtimeEnvelopeId: taskGraph.runtimeEnvelopeId,
      executionContractId: taskGraph.executionContractId,
      missionId: taskGraph.missionId,
      eventType: 'graph_evaluated',
      reasoning: 'task_graph_validation_and_status_derived',
      eventPayload: {
        taskGraphId,
        graphState: taskGraph.graphState,
        graphEligibilityState: taskGraph.graphEligibilityState,
        blockingReasons: taskGraph.blockingReasons,
      },
    });

    for (const node of taskGraph.taskNodes.filter((entry) => entry.taskState === 'ready')) {
      historyStore.append({
        taskGraphId,
        executionEngineRunId: taskGraph.executionEngineRunId,
        executionAttemptId: taskGraph.executionAttemptId,
        runtimeEnvelopeId: taskGraph.runtimeEnvelopeId,
        executionContractId: taskGraph.executionContractId,
        missionId: taskGraph.missionId,
        eventType: 'node_ready',
        reasoning: 'task_node_ready_after_dependency_evaluation',
        eventPayload: {
          taskNodeId: node.taskNodeId,
          taskName: node.taskName,
        },
      });
    }

    if (taskGraph.graphState === 'blocked') {
      historyStore.append({
        taskGraphId,
        executionEngineRunId: taskGraph.executionEngineRunId,
        executionAttemptId: taskGraph.executionAttemptId,
        runtimeEnvelopeId: taskGraph.runtimeEnvelopeId,
        executionContractId: taskGraph.executionContractId,
        missionId: taskGraph.missionId,
        eventType: 'graph_blocked',
        reasoning: 'task_graph_blocked_by_node_or_upstream_state',
        eventPayload: {
          taskGraphId,
          blockingReasons: taskGraph.blockingReasons,
        },
      });
    }

    if (taskGraph.graphState === 'completed') {
      historyStore.append({
        taskGraphId,
        executionEngineRunId: taskGraph.executionEngineRunId,
        executionAttemptId: taskGraph.executionAttemptId,
        runtimeEnvelopeId: taskGraph.runtimeEnvelopeId,
        executionContractId: taskGraph.executionContractId,
        missionId: taskGraph.missionId,
        eventType: 'graph_completed',
        reasoning: 'task_graph_completed_from_node_states',
        eventPayload: {
          taskGraphId,
          completedNodeCount: taskGraph.nodeCount,
        },
      });
    }

    return {
      taskGraph,
    };
  }

  function evaluateAllTaskGraphs(): TaskGraphEvaluationResult[] {
    return executionEngineProjection.projectAll()
      .map((run) => evaluateTaskGraph({ executionEngineRunId: run.executionEngineRunId }))
      .sort((left, right) => left.taskGraph.taskGraphId.localeCompare(right.taskGraph.taskGraphId));
  }

  return {
    evaluateTaskGraph,
    evaluateAllTaskGraphs,
  };
}

export type TaskGraphEvaluator = ReturnType<typeof createTaskGraphEvaluator>;
