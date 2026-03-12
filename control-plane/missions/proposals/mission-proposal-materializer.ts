import fs from 'node:fs';

import { canonicalStringify } from '../../finance/determinism.ts';

import {
  createMissionProposalHistoryStore,
  ensureMissionProposalArtifactDir,
  resolveMissionProposalArtifactPaths,
  type MissionProposalHistoryStore,
} from './mission-proposal-history-store.ts';
import {
  createMissionProposalProjection,
  type MissionProposalProjectionEngine,
} from './mission-proposal-projection.ts';
import type { MissionProposalProjection } from './mission-proposal-types.ts';

function toMarkdownReport(input: MissionProposalProjection): string {
  const lines = [
    '# Mission Proposal Report',
    '',
    `Proposal: ${input.displayName} (${input.proposalId})`,
    `Type: ${input.proposalType}`,
    '',
    '## Status Summary',
    `- proposalState: ${input.status.proposalState}`,
    `- approvalState: ${input.status.approvalState}`,
    `- conversionState: ${input.status.conversionState}`,
    `- blockingReasons: ${input.status.blockingReasons.join(', ') || 'none'}`,
    `- limitations: ${input.status.limitations.join(', ') || 'none'}`,
    '',
    '## Linked Object Summary',
    `- linkedMissionIds: ${input.linkedUpstreamObjects.linkedMissionIds.join(', ') || 'none'}`,
    `- linkedDagIds: ${input.linkedUpstreamObjects.linkedDagIds.join(', ') || 'none'}`,
    `- linkedActionPlanIds: ${input.linkedUpstreamObjects.linkedActionPlanIds.join(', ') || 'none'}`,
    `- linkedPortfolioIds: ${input.linkedUpstreamObjects.linkedPortfolioIds.join(', ') || 'none'}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify(input.reportPreview),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export interface MaterializedMissionProposal {
  proposalId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  conversionPath?: string;
}

export function createMissionProposalMaterializer(options: {
  projection?: MissionProposalProjectionEngine;
  historyStore?: MissionProposalHistoryStore;
  definitionsDir?: string;
  instancesDir?: string;
  missionTemplateDefinitionsDir?: string;
  missionDefinitionsDir?: string;
  missionDagDefinitionsDir?: string;
  missionProposalArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createMissionProposalProjection({
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
    missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionDagDefinitionsDir: options.missionDagDefinitionsDir,
    missionProposalArtifactsRoot: options.missionProposalArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionProposalHistoryStore({
    artifactsRoot: options.missionProposalArtifactsRoot,
  });

  function materializeProjection(input: { projection: MissionProposalProjection }): MaterializedMissionProposal {
    ensureMissionProposalArtifactDir({
      proposalId: input.projection.proposalId,
      rootDir: options.missionProposalArtifactsRoot,
    });

    const paths = resolveMissionProposalArtifactPaths({
      proposalId: input.projection.proposalId,
      rootDir: options.missionProposalArtifactsRoot,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection), 'utf8');

    const history = historyStore.load(input.projection.proposalId);
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');

    if (input.projection.conversionPreview) {
      fs.writeFileSync(paths.conversionJsonPath, `${canonicalStringify(input.projection.conversionPreview)}\n`, 'utf8');
    }

    return {
      proposalId: input.projection.proposalId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      ...(input.projection.conversionPreview ? { conversionPath: paths.conversionJsonPath } : {}),
    };
  }

  function materializeOne(proposalId: string): MaterializedMissionProposal {
    const projected = projection.projectOne(proposalId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne,
  };
}

export type MissionProposalMaterializer = ReturnType<typeof createMissionProposalMaterializer>;
