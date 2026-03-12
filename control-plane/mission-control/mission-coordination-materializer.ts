import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionCoordinationInspection,
  type MissionCoordinationInspection,
} from './mission-coordination-inspection.ts';
import {
  createMissionLifecycleHistoryStore,
  ensureMissionCoordinationArtifactDir,
  resolveMissionCoordinationArtifactPaths,
  type MissionLifecycleHistoryStore,
} from './mission-lifecycle-history-store.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Mission Coordination Report',
    '',
    canonicalStringify(reportPreview),
  ];

  return `${lines.join('\n')}\n`;
}

export interface MissionCoordinationMaterializationSummary {
  missionRunId: string;
  statusPath: string;
  lifecyclePath: string;
  interventionsPath: string;
  dependenciesPath: string;
  priorityPath: string;
  historyPath: string;
  reportPath: string;
}

export function createMissionCoordinationMaterializer(options: {
  inspection?: MissionCoordinationInspection;
  historyStore?: MissionLifecycleHistoryStore;
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
  const inspection = options.inspection ?? createMissionCoordinationInspection({
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

  const historyStore = options.historyStore ?? createMissionLifecycleHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { missionRunId: string }): MissionCoordinationMaterializationSummary {
    const coordination = inspection.inspectMissionCoordination(input);
    const lifecycle = inspection.inspectMissionLifecycle(input);
    const interventions = inspection.inspectMissionInterventions(input);
    const dependencies = inspection.inspectMissionDependencies(input);
    const priority = inspection.inspectMissionPriority(input);
    const history = inspection.inspectMissionCoordinationHistory(input);

    ensureMissionCoordinationArtifactDir({
      missionRunId: input.missionRunId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveMissionCoordinationArtifactPaths({
      missionRunId: input.missionRunId,
      rootDir: options.missionControlArtifactsRoot,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(coordination.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.lifecycleJsonPath, `${canonicalStringify(lifecycle)}\n`, 'utf8');
    fs.writeFileSync(paths.interventionsJsonPath, `${canonicalStringify(interventions)}\n`, 'utf8');
    fs.writeFileSync(paths.dependenciesJsonPath, `${canonicalStringify(dependencies)}\n`, 'utf8');
    fs.writeFileSync(paths.priorityJsonPath, `${canonicalStringify(priority)}\n`, 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(coordination.reportPreview), 'utf8');

    historyStore.write(history);

    return {
      missionRunId: input.missionRunId,
      statusPath: paths.statusJsonPath,
      lifecyclePath: paths.lifecycleJsonPath,
      interventionsPath: paths.interventionsJsonPath,
      dependenciesPath: paths.dependenciesJsonPath,
      priorityPath: paths.priorityJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportMarkdownPath,
    };
  }

  return {
    materializeOne,
  };
}

export type MissionCoordinationMaterializer = ReturnType<typeof createMissionCoordinationMaterializer>;
