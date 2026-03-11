import fs from 'node:fs';

import { canonicalStringify } from '../../finance/determinism.ts';

import {
  createMissionRegistry,
  type MissionRegistry,
} from '../mission-registry.ts';

import {
  createMissionDAGHistoryStore,
  ensureMissionDAGArtifactDir,
  resolveMissionDAGArtifactPaths,
  type MissionDAGHistoryStore,
} from './mission-dag-history-store.ts';
import {
  createMissionDAGProjection,
  type MissionDAGProjectionEngine,
} from './mission-dag-projection.ts';
import {
  createMissionDAGRegistry,
  type MissionDAGRegistry,
} from './mission-dag-registry.ts';
import type { MissionDAGProjection } from './mission-dag-types.ts';

function toTree(input: MissionDAGProjection): Record<string, unknown> {
  const childrenByParent = new Map<string, string[]>();

  for (const edge of input.edges) {
    const current = childrenByParent.get(edge.parentMissionId) ?? [];
    current.push(edge.childMissionId);
    current.sort((left, right) => left.localeCompare(right));
    childrenByParent.set(edge.parentMissionId, current);
  }

  function walk(missionId: string, visited: Set<string>): Record<string, unknown> {
    if (visited.has(missionId)) {
      return {
        missionId,
        cycleReference: true,
      };
    }

    const nextVisited = new Set(visited);
    nextVisited.add(missionId);

    const children = (childrenByParent.get(missionId) ?? []).map((childMissionId) => walk(childMissionId, nextVisited));

    return {
      missionId,
      children,
    };
  }

  return {
    dagId: input.dagId,
    rootMissionId: input.rootMissionId,
    nodes: input.nodes,
    edges: input.edges,
    tree: walk(input.rootMissionId, new Set<string>()),
  };
}

function toMarkdownReport(input: MissionDAGProjection): string {
  const lines = [
    '# Mission DAG Report',
    '',
    `DAG: ${input.dagId}`,
    `Root Mission: ${input.rootMissionId}`,
    '',
    '## Status Summary',
    `- dagStatus: ${input.dagStatus}`,
    `- readyNodes: ${input.readyNodes.join(', ') || 'none'}`,
    `- blockedNodes: ${input.blockedNodes.join(', ') || 'none'}`,
    `- completedNodes: ${input.completedNodes.join(', ') || 'none'}`,
    `- incompleteNodes: ${input.incompleteNodes.join(', ') || 'none'}`,
    '',
    '## Node States',
    ...input.nodeStates.map((entry) => `- ${entry.missionId}: ${entry.state} (dependsOn: ${entry.dependencyMissionIds.join(', ') || 'none'})`),
    '',
    '## Canonical JSON Payload',
    canonicalStringify({
      dagId: input.dagId,
      rootMissionId: input.rootMissionId,
      dagStatus: input.dagStatus,
      nodeStates: input.nodeStates,
    }),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export interface MaterializedMissionDAG {
  dagId: string;
  statusPath: string;
  treePath: string;
  reportPath: string;
  historyPath: string;
}

export function createMissionDAGMaterializer(options: {
  dagRegistry?: MissionDAGRegistry;
  missionRegistry?: MissionRegistry;
  projection?: MissionDAGProjectionEngine;
  historyStore?: MissionDAGHistoryStore;
  dagDefinitionsDir?: string;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionDAGArtifactsRoot?: string;
} = {}) {
  const missionRegistry = options.missionRegistry ?? createMissionRegistry({
    definitionsDir: options.missionDefinitionsDir,
    instancesDir: options.missionInstancesDir,
  });

  const dagRegistry = options.dagRegistry ?? createMissionDAGRegistry({
    definitionsDir: options.dagDefinitionsDir,
    missionRegistry,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
  });

  const projection = options.projection ?? createMissionDAGProjection({
    dagRegistry,
    missionRegistry,
    dagDefinitionsDir: options.dagDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionDAGArtifactsRoot: options.missionDAGArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionDAGHistoryStore({
    artifactsRoot: options.missionDAGArtifactsRoot,
  });

  function materializeProjection(input: { projection: MissionDAGProjection }): MaterializedMissionDAG {
    dagRegistry.getMissionDAGDefinition(input.projection.dagId);

    ensureMissionDAGArtifactDir({
      dagId: input.projection.dagId,
      rootDir: options.missionDAGArtifactsRoot,
    });

    const paths = resolveMissionDAGArtifactPaths({
      dagId: input.projection.dagId,
      rootDir: options.missionDAGArtifactsRoot,
    });

    const statusPreview = {
      dagId: input.projection.dagId,
      rootMissionId: input.projection.rootMissionId,
      nodeStates: input.projection.nodeStates,
      blockedNodes: input.projection.blockedNodes,
      readyNodes: input.projection.readyNodes,
      completedNodes: input.projection.completedNodes,
      incompleteNodes: input.projection.incompleteNodes,
      dagStatus: input.projection.dagStatus,
    };

    const treePayload = toTree(input.projection);

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.treeJsonPath, `${canonicalStringify(treePayload)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection), 'utf8');

    const history = historyStore.load(input.projection.dagId);
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');

    return {
      dagId: input.projection.dagId,
      statusPath: paths.statusJsonPath,
      treePath: paths.treeJsonPath,
      reportPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
    };
  }

  function materializeOne(dagId: string): MaterializedMissionDAG {
    const projected = projection.projectOne(dagId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne,
  };
}

export type MissionDAGMaterializer = ReturnType<typeof createMissionDAGMaterializer>;
