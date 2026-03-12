import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionRunHistoryStore,
  ensureMissionRunArtifactDir,
  resolveMissionRunArtifactPaths,
  type MissionRunHistoryStore,
} from './mission-run-history-store.ts';
import {
  createMissionRunInspection,
  type MissionRunInspection,
} from './mission-run-inspection.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Mission Control Operational Report',
    '',
    `${canonicalStringify(reportPreview)}`,
  ];

  return `${lines.join('\n')}\n`;
}

export interface MissionRunMaterializationSummary {
  missionRunId: string;
  statusPath: string;
  progressPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  escalationsPath: string;
  healthPath: string;
}

export function createMissionRunMaterializer(options: {
  inspection?: MissionRunInspection;
  historyStore?: MissionRunHistoryStore;
  missionControlArtifactsRoot?: string;
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
} = {}) {
  const inspection = options.inspection ?? createMissionRunInspection({
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

  const historyStore = options.historyStore ?? createMissionRunHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { missionRunId: string }): MissionRunMaterializationSummary {
    const evaluated = inspection.evaluateMissionRun(input);

    ensureMissionRunArtifactDir({
      missionRunId: evaluated.projection.missionRunId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveMissionRunArtifactPaths({
      missionRunId: evaluated.projection.missionRunId,
      rootDir: options.missionControlArtifactsRoot,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(evaluated.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.progressJsonPath, `${canonicalStringify(evaluated.projection.progressSummary)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(evaluated.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(evaluated.projection.reportPreview), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(evaluated.history)}\n`, 'utf8');
    fs.writeFileSync(paths.escalationsJsonPath, `${canonicalStringify(evaluated.projection.escalations)}\n`, 'utf8');
    fs.writeFileSync(paths.healthJsonPath, `${canonicalStringify({
      missionRunId: evaluated.projection.missionRunId,
      healthState: evaluated.projection.healthState,
      completionState: evaluated.projection.completionState,
      operationalState: evaluated.projection.operationalState,
      blockingReasons: evaluated.projection.blockingReasons,
    })}\n`, 'utf8');

    historyStore.write(evaluated.history);

    return {
      missionRunId: evaluated.projection.missionRunId,
      statusPath: paths.statusJsonPath,
      progressPath: paths.progressJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      escalationsPath: paths.escalationsJsonPath,
      healthPath: paths.healthJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type MissionRunMaterializer = ReturnType<typeof createMissionRunMaterializer>;
