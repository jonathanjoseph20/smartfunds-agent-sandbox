import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionReviewHistoryStore,
  ensureMissionReviewArtifactDir,
  resolveMissionReviewArtifactPaths,
  type MissionReviewHistoryStore,
} from './mission-review-history-store.ts';
import {
  createMissionReviewInspection,
  type MissionReviewInspection,
} from './mission-review-inspection.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Mission Review Report',
    '',
    canonicalStringify(reportPreview),
  ];

  return `${lines.join('\n')}\n`;
}

export interface MissionReviewMaterializationSummary {
  missionRunId: string;
  statusPath: string;
  queuePath: string;
  requirementsPath: string;
  decisionHistoryPath: string;
  decisionOutcomePath: string;
  reportPath: string;
  reportMarkdownPath: string;
  historyPath: string;
}

export function createMissionReviewMaterializer(options: {
  inspection?: MissionReviewInspection;
  historyStore?: MissionReviewHistoryStore;
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
  const inspection = options.inspection ?? createMissionReviewInspection({
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

  const historyStore = options.historyStore ?? createMissionReviewHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { missionRunId: string }): MissionReviewMaterializationSummary {
    const queueEntry = inspection.inspectReviewQueueEntry(input);
    const status = inspection.inspectGovernanceStatus(input);
    const requirements = inspection.inspectReviewRequirements(input);
    const decisionHistory = inspection.inspectDecisionHistory(input);
    const decisionOutcome = inspection.inspectDecisionOutcome(input);

    ensureMissionReviewArtifactDir({
      missionRunId: input.missionRunId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveMissionReviewArtifactPaths({
      missionRunId: input.missionRunId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const reportPreview = {
      missionRunId: input.missionRunId,
      status,
      queueEntry,
      requirements,
      decisionOutcome,
      decisionHistory,
    } as Record<string, unknown>;

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(status)}\n`, 'utf8');
    fs.writeFileSync(paths.queueJsonPath, `${canonicalStringify(queueEntry)}\n`, 'utf8');
    fs.writeFileSync(paths.requirementsJsonPath, `${canonicalStringify(requirements)}\n`, 'utf8');
    fs.writeFileSync(paths.decisionHistoryJsonPath, `${canonicalStringify(decisionHistory)}\n`, 'utf8');
    fs.writeFileSync(paths.decisionOutcomeJsonPath, `${canonicalStringify(decisionOutcome)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(reportPreview), 'utf8');

    historyStore.write({
      missionRunId: input.missionRunId,
      entries: decisionHistory,
    });

    return {
      missionRunId: input.missionRunId,
      statusPath: paths.statusJsonPath,
      queuePath: paths.queueJsonPath,
      requirementsPath: paths.requirementsJsonPath,
      decisionHistoryPath: paths.decisionHistoryJsonPath,
      decisionOutcomePath: paths.decisionOutcomeJsonPath,
      reportPath: paths.reportJsonPath,
      reportMarkdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type MissionReviewMaterializer = ReturnType<typeof createMissionReviewMaterializer>;
