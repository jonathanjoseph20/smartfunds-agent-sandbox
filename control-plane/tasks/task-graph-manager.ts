import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { createEngineeringPlanManager } from '../engineering/engineering-plan-manager.ts';
import type { EngineeringPlan } from '../engineering/engineering-plan-types.ts';
import { validateEngineeringPlan } from '../engineering/engineering-plan-validation.ts';

import {
  deriveImplementationTaskEdgeId,
  deriveImplementationTaskGraphId,
  deriveImplementationTaskNodeId,
  normalizeImplementationTaskEdges,
  normalizeImplementationTaskGraphStructure,
  normalizeImplementationTaskNodes,
} from './task-graph-identity.ts';
import {
  createImplementationTaskGraphHistoryStore,
  type ImplementationTaskGraphHistoryStore,
} from './task-graph-history-store.ts';
import { projectImplementationTaskGraph } from './task-graph-projection.ts';
import { validateImplementationTaskGraph } from './task-graph-validation.ts';
import type {
  ImplementationTaskGraph,
  ImplementationTaskGraphProjection,
} from './task-graph-types.ts';

const DEFAULT_IMPLEMENTATION_TASK_GRAPHS_FILE = path.join(
  'runtime-data',
  'tasks',
  'implementation-task-graphs.json',
);

type ImplementationTaskGraphStore = {
  taskGraphs: ImplementationTaskGraph[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  return JSON.parse(canonicalStringify(value)) as Record<string, unknown>;
}

function parseTaskNode(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_NODE');
  }

  const taskNodeId = asString(value.taskNodeId);
  const taskGraphId = asString(value.taskGraphId);
  const planId = asString(value.planId);
  const taskType = asString(value.taskType);
  const taskName = normalizeString(value.taskName);
  const taskDescription = normalizeString(value.taskDescription);

  if (!taskNodeId || !taskGraphId || !planId || (taskType !== 'implementation_phase' && taskType !== 'plan_completion')) {
    throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_NODE');
  }

  return {
    taskNodeId,
    taskGraphId,
    planId,
    taskType,
    taskName,
    taskDescription,
    taskInputs: normalizeRecord(value.taskInputs),
    requiredCapabilities: normalizeStringArray(value.requiredCapabilities),
  };
}

function parseTaskEdge(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_EDGE');
  }

  const taskEdgeId = asString(value.taskEdgeId);
  const taskGraphId = asString(value.taskGraphId);
  const sourceNodeId = asString(value.sourceNodeId);
  const targetNodeId = asString(value.targetNodeId);
  const dependencyType = asString(value.dependencyType);

  if (!taskEdgeId || !taskGraphId || !sourceNodeId || !targetNodeId || dependencyType !== 'finish_to_start') {
    throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_EDGE');
  }

  return {
    taskEdgeId,
    taskGraphId,
    sourceNodeId,
    targetNodeId,
    dependencyType,
  } as const;
}

function parseTaskGraph(value: unknown): ImplementationTaskGraph {
  if (!isRecord(value)) {
    throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_GRAPH');
  }

  const taskGraphId = asString(value.taskGraphId);
  const planId = asString(value.planId);
  const specId = asString(value.specId);

  if (!taskGraphId || !planId || !specId) {
    throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_GRAPH');
  }

  const taskNodes = Array.isArray(value.taskNodes)
    ? value.taskNodes.map((node) => parseTaskNode(node)).sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))
    : [];

  const taskEdges = Array.isArray(value.taskEdges)
    ? value.taskEdges.map((edge) => parseTaskEdge(edge)).sort((left, right) => {
      const bySource = left.sourceNodeId.localeCompare(right.sourceNodeId);
      if (bySource !== 0) {
        return bySource;
      }
      const byTarget = left.targetNodeId.localeCompare(right.targetNodeId);
      if (byTarget !== 0) {
        return byTarget;
      }
      return left.dependencyType.localeCompare(right.dependencyType);
    })
    : [];

  return {
    taskGraphId,
    planId,
    specId,
    taskNodes,
    taskEdges,
    nodeCount: typeof value.nodeCount === 'number' ? value.nodeCount : taskNodes.length,
    edgeCount: typeof value.edgeCount === 'number' ? value.edgeCount : taskEdges.length,
    limitations: normalizeStringArray(value.limitations),
    provenanceInputs: {
      architectureSummary: normalizeString(value.provenanceInputs && isRecord(value.provenanceInputs)
        ? value.provenanceInputs.architectureSummary
        : undefined),
      implementationPhases: normalizeStringArray(value.provenanceInputs && isRecord(value.provenanceInputs)
        ? value.provenanceInputs.implementationPhases
        : undefined),
      subsystems: normalizeStringArray(value.provenanceInputs && isRecord(value.provenanceInputs)
        ? value.provenanceInputs.subsystems
        : undefined),
      dependencies: normalizeStringArray(value.provenanceInputs && isRecord(value.provenanceInputs)
        ? value.provenanceInputs.dependencies
        : undefined),
      integrationRequirements: normalizeStringArray(value.provenanceInputs && isRecord(value.provenanceInputs)
        ? value.provenanceInputs.integrationRequirements
        : undefined),
      testStrategy: normalizeString(value.provenanceInputs && isRecord(value.provenanceInputs)
        ? value.provenanceInputs.testStrategy
        : undefined),
      constraints: normalizeStringArray(value.provenanceInputs && isRecord(value.provenanceInputs)
        ? value.provenanceInputs.constraints
        : undefined),
    },
  };
}

function readStore(filePath: string): ImplementationTaskGraphStore {
  if (!fs.existsSync(filePath)) {
    return { taskGraphs: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_STORE');
  }

  const taskGraphs = Array.isArray(parsed.taskGraphs)
    ? parsed.taskGraphs.map((entry) => parseTaskGraph(entry)).sort((left, right) => left.taskGraphId.localeCompare(right.taskGraphId))
    : [];

  return { taskGraphs };
}

function writeStore(filePath: string, store: ImplementationTaskGraphStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalStringify({
    taskGraphs: [...store.taskGraphs].sort((left, right) => left.taskGraphId.localeCompare(right.taskGraphId)),
  })}\n`, 'utf8');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function deriveTaskPhaseSeeds(plan: EngineeringPlan): Array<{
  phaseKey: string;
  taskType: 'implementation_phase' | 'plan_completion';
  taskName: string;
  taskDescription: string;
  taskInputs: Record<string, unknown>;
  requiredCapabilities: string[];
}> {
  const implementationPhases = uniqueSorted(plan.implementationPhases.map((entry) => entry.trim()).filter((entry) => entry.length > 0));
  const requiredCapabilities = uniqueSorted(plan.subsystems);

  if (implementationPhases.length === 0) {
    return [
      {
        phaseKey: 'plan_completion_required',
        taskType: 'plan_completion',
        taskName: 'Complete engineering plan phases',
        taskDescription: 'Deterministic placeholder task used when implementation phases are missing in EngineeringPlan.',
        taskInputs: {
          planId: plan.planId,
          specId: plan.specId,
          missingField: 'implementationPhases',
        },
        requiredCapabilities,
      },
    ];
  }

  return implementationPhases.map((phaseName, index) => ({
    phaseKey: `phase_${String(index).padStart(4, '0')}_${phaseName}`,
    taskType: 'implementation_phase',
    taskName: `Implement ${phaseName}`,
    taskDescription: `Deterministic implementation task derived from engineering phase ${phaseName}.`,
    taskInputs: {
      planId: plan.planId,
      specId: plan.specId,
      phaseName,
      architectureSummary: plan.architectureSummary,
      dependencies: uniqueSorted(plan.dependencies),
      integrationRequirements: uniqueSorted(plan.integrationRequirements),
      testStrategy: plan.testStrategy,
      constraints: uniqueSorted(plan.constraints),
    },
    requiredCapabilities,
  }));
}

function deriveTaskEdgeSeeds(phaseSeeds: Array<{ phaseKey: string }>): Array<{
  sourcePhaseKey: string;
  targetPhaseKey: string;
  dependencyType: 'finish_to_start';
}> {
  if (phaseSeeds.length < 2) {
    return [];
  }

  const edges: Array<{
    sourcePhaseKey: string;
    targetPhaseKey: string;
    dependencyType: 'finish_to_start';
  }> = [];

  for (let index = 1; index < phaseSeeds.length; index += 1) {
    edges.push({
      sourcePhaseKey: phaseSeeds[index - 1]!.phaseKey,
      targetPhaseKey: phaseSeeds[index]!.phaseKey,
      dependencyType: 'finish_to_start',
    });
  }

  return edges;
}

function toPayloadHash(value: unknown): string {
  return sha256(canonicalStringify(value));
}

export function createImplementationTaskGraphManager(options: {
  taskGraphsFilePath?: string;
  historyStore?: ImplementationTaskGraphHistoryStore;
  historyFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
} = {}) {
  const taskGraphsFilePath = options.taskGraphsFilePath ?? DEFAULT_IMPLEMENTATION_TASK_GRAPHS_FILE;
  const historyStore = options.historyStore ?? createImplementationTaskGraphHistoryStore({
    historyFilePath: options.historyFilePath,
  });

  const engineeringPlanManager = createEngineeringPlanManager({
    plansFilePath: options.plansFilePath,
    historyFilePath: options.engineeringPlanHistoryFilePath,
  });

  function getImplementationTaskGraph(taskGraphId: string): ImplementationTaskGraph {
    const graph = readStore(taskGraphsFilePath).taskGraphs.find((entry) => entry.taskGraphId === taskGraphId);
    if (!graph) {
      throw new Error(`IMPLEMENTATION_TASK_GRAPH_NOT_FOUND: ${taskGraphId}`);
    }

    return graph;
  }

  function listImplementationTaskGraphs(): ImplementationTaskGraph[] {
    return readStore(taskGraphsFilePath).taskGraphs;
  }

  function createImplementationTaskGraph(input: {
    planId: string;
  }): {
    taskGraphId: string;
    graph: ImplementationTaskGraph;
    projection: ImplementationTaskGraphProjection;
  } {
    const plan = engineeringPlanManager.getEngineeringPlan(input.planId);

    const phaseSeeds = deriveTaskPhaseSeeds(plan);
    const edgeSeeds = deriveTaskEdgeSeeds(phaseSeeds);

    const normalizedStructure = normalizeImplementationTaskGraphStructure({
      nodes: phaseSeeds,
      edges: edgeSeeds,
    });

    const taskGraphId = deriveImplementationTaskGraphId({
      planId: plan.planId,
      specId: plan.specId,
      architectureSummary: plan.architectureSummary,
      testStrategy: plan.testStrategy,
      normalizedGraphStructure: normalizedStructure,
    });

    const store = readStore(taskGraphsFilePath);
    const existing = store.taskGraphs.find((entry) => entry.taskGraphId === taskGraphId);
    if (existing) {
      return {
        taskGraphId,
        graph: existing,
        projection: deriveImplementationTaskGraphProjection(taskGraphId),
      };
    }

    const nodesByPhaseKey = new Map<string, { taskNodeId: string }>();

    const taskNodes = phaseSeeds.map((seed) => {
      const taskNodeId = deriveImplementationTaskNodeId({
        taskGraphId,
        phaseKey: seed.phaseKey,
        taskType: seed.taskType,
        taskInputs: seed.taskInputs,
      });

      nodesByPhaseKey.set(seed.phaseKey, { taskNodeId });

      return {
        taskNodeId,
        taskGraphId,
        planId: plan.planId,
        taskType: seed.taskType,
        taskName: seed.taskName,
        taskDescription: seed.taskDescription,
        taskInputs: JSON.parse(canonicalStringify(seed.taskInputs)) as Record<string, unknown>,
        requiredCapabilities: uniqueSorted(seed.requiredCapabilities),
      };
    });

    const taskEdges = edgeSeeds.map((seed) => {
      const sourceNode = nodesByPhaseKey.get(seed.sourcePhaseKey);
      const targetNode = nodesByPhaseKey.get(seed.targetPhaseKey);
      if (!sourceNode || !targetNode) {
        throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_EDGE_REFERENCE');
      }

      return {
        taskEdgeId: deriveImplementationTaskEdgeId({
          taskGraphId,
          sourceNodeId: sourceNode.taskNodeId,
          targetNodeId: targetNode.taskNodeId,
          dependencyType: 'finish_to_start',
        }),
        taskGraphId,
        sourceNodeId: sourceNode.taskNodeId,
        targetNodeId: targetNode.taskNodeId,
        dependencyType: 'finish_to_start' as const,
      };
    });

    const graph: ImplementationTaskGraph = {
      taskGraphId,
      planId: plan.planId,
      specId: plan.specId,
      taskNodes: normalizeImplementationTaskNodes(taskNodes),
      taskEdges: normalizeImplementationTaskEdges(taskEdges),
      nodeCount: taskNodes.length,
      edgeCount: taskEdges.length,
      limitations: uniqueSorted([
        'derived_only_from_engineering_plan',
        'no_runtime_dispatch_in_pf3',
      ]),
      provenanceInputs: {
        architectureSummary: plan.architectureSummary,
        implementationPhases: uniqueSorted(plan.implementationPhases),
        subsystems: uniqueSorted(plan.subsystems),
        dependencies: uniqueSorted(plan.dependencies),
        integrationRequirements: uniqueSorted(plan.integrationRequirements),
        testStrategy: plan.testStrategy,
        constraints: uniqueSorted(plan.constraints),
      },
    };

    const graphValidation = validateImplementationTaskGraph(graph);
    if (graphValidation.validationState === 'invalid') {
      throw new Error(`IMPLEMENTATION_TASK_GRAPH_INVALID: ${graphValidation.constraintViolations.join(',')}`);
    }

    writeStore(taskGraphsFilePath, {
      taskGraphs: [...store.taskGraphs, graph],
    });

    historyStore.appendImplementationTaskGraphEvent({
      eventType: 'implementation_task_graph_created',
      taskGraphId,
      payloadHash: toPayloadHash(graph),
    });

    return {
      taskGraphId,
      graph,
      projection: deriveImplementationTaskGraphProjection(taskGraphId),
    };
  }

  function deriveImplementationTaskGraphProjection(taskGraphId: string): ImplementationTaskGraphProjection {
    const graph = getImplementationTaskGraph(taskGraphId);
    const plan = engineeringPlanManager.getEngineeringPlan(graph.planId);
    const planValidation = validateEngineeringPlan(plan);
    const graphValidation = validateImplementationTaskGraph(graph);
    const historyEvents = historyStore.listImplementationTaskGraphEvents(taskGraphId);

    return projectImplementationTaskGraph({
      graph,
      planValidation,
      graphValidation,
      historyEvents,
    });
  }

  function listImplementationTaskGraphProjections(): ImplementationTaskGraphProjection[] {
    return listImplementationTaskGraphs()
      .map((graph) => deriveImplementationTaskGraphProjection(graph.taskGraphId))
      .sort((left, right) => left.taskGraphId.localeCompare(right.taskGraphId));
  }

  return {
    historyStore,
    getImplementationTaskGraph,
    listImplementationTaskGraphs,
    createImplementationTaskGraph,
    deriveImplementationTaskGraphProjection,
    listImplementationTaskGraphProjections,
  };
}

export type ImplementationTaskGraphManager = ReturnType<typeof createImplementationTaskGraphManager>;
