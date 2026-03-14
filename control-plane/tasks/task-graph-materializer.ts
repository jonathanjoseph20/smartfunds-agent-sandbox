import fs from 'node:fs';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createImplementationTaskGraphManager,
  type ImplementationTaskGraphManager,
} from './task-graph-manager.ts';
import {
  resolveImplementationTaskGraphArtifactPaths,
} from './task-graph-artifacts.ts';
import {
  validateImplementationTaskGraph,
} from './task-graph-validation.ts';
import type {
  ImplementationTaskGraphMaterializationSummary,
} from './task-graph-types.ts';

function toMarkdownReport(input: {
  graph: unknown;
  projection: unknown;
  planValidation: unknown;
  graphValidation: unknown;
  historyEvents: unknown;
  digest: string;
}): string {
  return [
    '# Implementation Task Graph Report',
    '',
    `${canonicalStringify(input)}`,
    '',
  ].join('\n');
}

export function createImplementationTaskGraphMaterializer(options: {
  manager?: ImplementationTaskGraphManager;
  artifactsRoot?: string;
  taskGraphsFilePath?: string;
  historyFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
} = {}) {
  const manager = options.manager ?? createImplementationTaskGraphManager({
    taskGraphsFilePath: options.taskGraphsFilePath,
    historyFilePath: options.historyFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function materializeImplementationTaskGraph(taskGraphId: string): ImplementationTaskGraphMaterializationSummary {
    const graph = manager.getImplementationTaskGraph(taskGraphId);

    const graphValidation = validateImplementationTaskGraph(graph);

    manager.historyStore.appendImplementationTaskGraphEvent({
      eventType: 'implementation_task_graph_materialized',
      taskGraphId: graph.taskGraphId,
      payloadHash: sha256(canonicalStringify({ taskGraphId: graph.taskGraphId })),
    });

    const projection = manager.deriveImplementationTaskGraphProjection(taskGraphId);
    const historyEvents = manager.historyStore.listImplementationTaskGraphEvents(taskGraphId);
    const planValidation = {
      validationState: projection.planValidationState,
      missingFields: projection.planMissingFields,
      constraintViolations: projection.planConstraintViolations,
    };

    const paths = resolveImplementationTaskGraphArtifactPaths({
      taskGraphId,
      artifactsRoot: options.artifactsRoot,
    });

    fs.mkdirSync(paths.dirPath, { recursive: true });

    fs.writeFileSync(paths.graphPath, `${canonicalStringify(graph)}\n`, 'utf8');
    fs.writeFileSync(paths.statusPath, `${canonicalStringify({
      taskGraphId: graph.taskGraphId,
      planId: graph.planId,
      specId: graph.specId,
      status: projection.status,
      planValidationState: projection.planValidationState,
      graphValidationState: graphValidation.validationState,
      historySummary: projection.historySummary,
    })}\n`, 'utf8');
    fs.writeFileSync(paths.historyPath, `${canonicalStringify({
      taskGraphId: graph.taskGraphId,
      entries: historyEvents,
    })}\n`, 'utf8');
    fs.writeFileSync(paths.nodesPath, `${canonicalStringify(graph.taskNodes)}\n`, 'utf8');
    fs.writeFileSync(paths.edgesPath, `${canonicalStringify(graph.taskEdges)}\n`, 'utf8');
    fs.writeFileSync(paths.reportPath, toMarkdownReport({
      graph,
      projection,
      planValidation,
      graphValidation,
      historyEvents,
      digest: sha256(canonicalStringify({ graph, projection, planValidation, graphValidation, historyEvents })),
    }), 'utf8');

    return {
      taskGraphId: graph.taskGraphId,
      planId: graph.planId,
      specId: graph.specId,
      graphPath: paths.graphPath,
      statusPath: paths.statusPath,
      historyPath: paths.historyPath,
      reportPath: paths.reportPath,
      nodesPath: paths.nodesPath,
      edgesPath: paths.edgesPath,
    };
  }

  return {
    materializeImplementationTaskGraph,
  };
}

export type ImplementationTaskGraphMaterializer = ReturnType<typeof createImplementationTaskGraphMaterializer>;
