import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionPortfolioAttentionHistoryStore,
  ensureMissionPortfolioAttentionArtifactDir,
  resolveMissionPortfolioAttentionArtifactPaths,
  type MissionPortfolioAttentionHistoryStore,
} from './mission-portfolio-attention-history-store.ts';
import {
  createMissionPortfolioAttentionInspection,
  type MissionPortfolioAttentionInspection,
} from './mission-portfolio-attention-inspection.ts';
import {
  createMissionPortfolioAttentionProjection,
  type MissionPortfolioAttentionProjectionEngine,
} from './mission-portfolio-attention-projection.ts';

function toMarkdownReport(input: {
  missionPortfolioId: string;
  status: Record<string, unknown>;
  queueEntry: unknown;
  requirements: unknown;
  escalations: unknown;
  actionOutcome: Record<string, unknown>;
  actionHistory: unknown;
}): string {
  const sections: Array<{ title: string; value: unknown }> = [
    { title: 'Mission Portfolio Attention Status', value: input.status },
    { title: 'Mission Portfolio Attention Queue', value: input.queueEntry },
    { title: 'Mission Portfolio Attention Requirements', value: input.requirements },
    { title: 'Mission Portfolio Escalations', value: input.escalations },
    { title: 'Mission Portfolio Action Outcome', value: input.actionOutcome },
    { title: 'Mission Portfolio Action History', value: input.actionHistory },
  ];

  const lines = [
    '# Mission Portfolio Attention Report',
    '',
    `Portfolio: ${input.missionPortfolioId}`,
    '',
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(canonicalStringify(section.value));
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

export interface MissionPortfolioAttentionMaterializationSummary {
  missionPortfolioId: string;
  statusPath: string;
  queuePath: string;
  escalationsPath: string;
  requirementsPath: string;
  actionHistoryPath: string;
  actionOutcomePath: string;
  historyPath: string;
  reportPath: string;
  reportMarkdownPath: string;
}

export function createMissionPortfolioAttentionMaterializer(options: {
  inspection?: MissionPortfolioAttentionInspection;
  projection?: MissionPortfolioAttentionProjectionEngine;
  historyStore?: MissionPortfolioAttentionHistoryStore;
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
  taskExecutionArtifactsRoot?: string;
  missionControlArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createMissionPortfolioAttentionProjection({
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
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  const inspection = options.inspection ?? createMissionPortfolioAttentionInspection({
    projection,
  });

  const historyStore = options.historyStore ?? createMissionPortfolioAttentionHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { missionPortfolioId: string }): MissionPortfolioAttentionMaterializationSummary {
    const projected = projection.projectOne(input);

    ensureMissionPortfolioAttentionArtifactDir({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveMissionPortfolioAttentionArtifactPaths({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const status = inspection.inspectPortfolioAttentionStatus(input);
    const requirements = inspection.inspectPortfolioAttentionRequirements(input);
    const escalations = inspection.inspectPortfolioEscalations(input);
    const actionHistory = inspection.inspectPortfolioActionHistory(input);
    const actionOutcome = inspection.inspectPortfolioActionOutcome(input);
    const queue = projected.queueEntry;

    const reportPreview = {
      missionPortfolioId: input.missionPortfolioId,
      status,
      queue,
      requirements,
      escalations,
      actionOutcome,
      actionHistory,
    } as Record<string, unknown>;

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(status)}\n`, 'utf8');
    fs.writeFileSync(paths.queueJsonPath, `${canonicalStringify(queue)}\n`, 'utf8');
    fs.writeFileSync(paths.requirementsJsonPath, `${canonicalStringify(requirements)}\n`, 'utf8');
    fs.writeFileSync(paths.escalationsJsonPath, `${canonicalStringify(escalations)}\n`, 'utf8');
    fs.writeFileSync(paths.actionHistoryJsonPath, `${canonicalStringify(actionHistory)}\n`, 'utf8');
    fs.writeFileSync(paths.actionOutcomeJsonPath, `${canonicalStringify(actionOutcome)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      missionPortfolioId: input.missionPortfolioId,
      status,
      queueEntry: queue,
      requirements,
      escalations,
      actionOutcome,
      actionHistory,
    }), 'utf8');

    historyStore.write({
      missionPortfolioId: input.missionPortfolioId,
      entries: actionHistory,
    });

    return {
      missionPortfolioId: input.missionPortfolioId,
      statusPath: paths.statusJsonPath,
      queuePath: paths.queueJsonPath,
      escalationsPath: paths.escalationsJsonPath,
      requirementsPath: paths.requirementsJsonPath,
      actionHistoryPath: paths.actionHistoryJsonPath,
      actionOutcomePath: paths.actionOutcomeJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportJsonPath,
      reportMarkdownPath: paths.reportMarkdownPath,
    };
  }

  return {
    materializeOne,
  };
}

export type MissionPortfolioAttentionMaterializer = ReturnType<typeof createMissionPortfolioAttentionMaterializer>;
