import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionPortfolioResolutionHistoryStore,
  ensureMissionPortfolioResolutionArtifactDir,
  resolveMissionPortfolioResolutionArtifactPaths,
  type MissionPortfolioResolutionHistoryStore,
} from './mission-portfolio-resolution-history-store.ts';
import {
  createMissionPortfolioResolutionInspection,
  type MissionPortfolioResolutionInspection,
} from './mission-portfolio-resolution-inspection.ts';
import {
  createMissionPortfolioResolutionProjection,
  type MissionPortfolioResolutionProjectionEngine,
} from './mission-portfolio-resolution-projection.ts';

function toMarkdownReport(input: {
  missionPortfolioId: string;
  stabilization: unknown;
  resolutionStatus: unknown;
  closureEligibility: unknown;
  queue: unknown;
  actionHistory: unknown;
  closureState: unknown;
  outcome: unknown;
}): string {
  const sections: Array<{ title: string; value: unknown }> = [
    { title: 'Mission Portfolio Stabilization', value: input.stabilization },
    { title: 'Mission Portfolio Resolution Status', value: input.resolutionStatus },
    { title: 'Mission Portfolio Closure Eligibility', value: input.closureEligibility },
    { title: 'Mission Portfolio Resolution Queue', value: input.queue },
    { title: 'Mission Portfolio Resolution Action History', value: input.actionHistory },
    { title: 'Mission Portfolio Closure State', value: input.closureState },
    { title: 'Mission Portfolio Resolution Outcome', value: input.outcome },
  ];

  const lines = [
    '# Mission Portfolio Resolution Report',
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

export interface MissionPortfolioResolutionMaterializationSummary {
  missionPortfolioId: string;
  stabilizationPath: string;
  resolutionStatusPath: string;
  closureEligibilityPath: string;
  resolutionQueuePath: string;
  resolutionActionHistoryPath: string;
  closureStatePath: string;
  resolutionOutcomePath: string;
  historyPath: string;
  reportPath: string;
  reportMarkdownPath: string;
}

export function createMissionPortfolioResolutionMaterializer(options: {
  inspection?: MissionPortfolioResolutionInspection;
  projection?: MissionPortfolioResolutionProjectionEngine;
  historyStore?: MissionPortfolioResolutionHistoryStore;
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
  const projection = options.projection ?? createMissionPortfolioResolutionProjection({
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

  const inspection = options.inspection ?? createMissionPortfolioResolutionInspection({
    projection,
  });

  const historyStore = options.historyStore ?? createMissionPortfolioResolutionHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { missionPortfolioId: string }): MissionPortfolioResolutionMaterializationSummary {
    const projected = projection.projectOne(input);

    ensureMissionPortfolioResolutionArtifactDir({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveMissionPortfolioResolutionArtifactPaths({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const stabilization = inspection.inspectStabilization(input);
    const resolutionStatus = inspection.inspectResolutionStatus(input);
    const closureEligibility = inspection.inspectClosureEligibility(input);
    const closureState = inspection.inspectClosureState(input);
    const actionHistory = inspection.inspectResolutionActionHistory(input);
    const outcome = inspection.inspectResolutionOutcome(input);
    const queue = projected.queueEntry;

    const reportPreview = {
      missionPortfolioId: input.missionPortfolioId,
      stabilization,
      resolutionStatus,
      closureEligibility,
      queue,
      actionHistory,
      closureState,
      outcome,
    } as Record<string, unknown>;

    fs.writeFileSync(paths.stabilizationJsonPath, `${canonicalStringify(stabilization)}\n`, 'utf8');
    fs.writeFileSync(paths.resolutionStatusJsonPath, `${canonicalStringify(resolutionStatus)}\n`, 'utf8');
    fs.writeFileSync(paths.closureEligibilityJsonPath, `${canonicalStringify(closureEligibility)}\n`, 'utf8');
    fs.writeFileSync(paths.resolutionQueueJsonPath, `${canonicalStringify(queue)}\n`, 'utf8');
    fs.writeFileSync(paths.resolutionActionHistoryJsonPath, `${canonicalStringify(actionHistory)}\n`, 'utf8');
    fs.writeFileSync(paths.closureStateJsonPath, `${canonicalStringify(closureState)}\n`, 'utf8');
    fs.writeFileSync(paths.resolutionOutcomeJsonPath, `${canonicalStringify(outcome)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      missionPortfolioId: input.missionPortfolioId,
      stabilization,
      resolutionStatus,
      closureEligibility,
      queue,
      actionHistory,
      closureState,
      outcome,
    }), 'utf8');

    historyStore.write({
      missionPortfolioId: input.missionPortfolioId,
      entries: actionHistory,
    });

    return {
      missionPortfolioId: input.missionPortfolioId,
      stabilizationPath: paths.stabilizationJsonPath,
      resolutionStatusPath: paths.resolutionStatusJsonPath,
      closureEligibilityPath: paths.closureEligibilityJsonPath,
      resolutionQueuePath: paths.resolutionQueueJsonPath,
      resolutionActionHistoryPath: paths.resolutionActionHistoryJsonPath,
      closureStatePath: paths.closureStateJsonPath,
      resolutionOutcomePath: paths.resolutionOutcomeJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportJsonPath,
      reportMarkdownPath: paths.reportMarkdownPath,
    };
  }

  return {
    materializeOne,
  };
}

export type MissionPortfolioResolutionMaterializer = ReturnType<typeof createMissionPortfolioResolutionMaterializer>;
