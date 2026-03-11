import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionHistoryStore,
  ensureMissionArtifactDir,
  resolveMissionArtifactPaths,
  type MissionHistoryStore,
} from './mission-history-store.ts';
import {
  createMissionProjection,
  type MissionProjectionEngine,
} from './mission-projection.ts';
import type { MissionProjection } from './mission-types.ts';

function toMarkdownReport(input: MissionProjection): string {
  const lines = [
    '# Mission Registry Report',
    '',
    `Mission: ${input.displayName} (${input.missionId})`,
    `Type: ${input.missionType}`,
    '',
    '## Status Summary',
    `- approvalState: ${input.status.approvalState}`,
    `- lifecycleState: ${input.status.lifecycleState}`,
    `- readinessState: ${input.status.readinessState}`,
    `- completionState: ${input.status.completionState}`,
    `- blockingReasons: ${input.status.blockingReasons.join(', ') || 'none'}`,
    `- limitations: ${input.status.limitations.join(', ') || 'none'}`,
    '',
    '## Deliverable Summary',
    `- totalRequested: ${String(input.deliverableSummary.totalRequested)}`,
    `- satisfied: ${String(input.deliverableSummary.satisfied)}`,
    `- pending: ${String(input.deliverableSummary.pending)}`,
    '',
    '## Linked Object Summary',
    `- linkedActionPlanIds: ${input.linkedUpstreamObjects.linkedActionPlanIds.join(', ') || 'none'}`,
    `- linkedPortfolioIds: ${input.linkedUpstreamObjects.linkedPortfolioIds.join(', ') || 'none'}`,
    `- linkedMarketSynthesisIds: ${input.linkedUpstreamObjects.linkedMarketSynthesisIds.join(', ') || 'none'}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify(input.reportPreview),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export interface MaterializedMission {
  missionId: string;
  statusPath: string;
  historyPath: string;
  reportPath: string;
  markdownPath: string;
}

export function createMissionMaterializer(options: {
  projection?: MissionProjectionEngine;
  historyStore?: MissionHistoryStore;
  definitionsDir?: string;
  instancesDir?: string;
  missionArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createMissionProjection({
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionHistoryStore({
    artifactsRoot: options.missionArtifactsRoot,
  });

  function materializeProjection(input: { projection: MissionProjection }): MaterializedMission {
    ensureMissionArtifactDir({
      missionId: input.projection.missionId,
      rootDir: options.missionArtifactsRoot,
    });

    const paths = resolveMissionArtifactPaths({
      missionId: input.projection.missionId,
      rootDir: options.missionArtifactsRoot,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection), 'utf8');

    const history = historyStore.load(input.projection.missionId);
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');

    return {
      missionId: input.projection.missionId,
      statusPath: paths.statusJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
    };
  }

  function materializeOne(missionId: string): MaterializedMission {
    const projected = projection.projectOne(missionId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne,
  };
}

export type MissionMaterializer = ReturnType<typeof createMissionMaterializer>;
