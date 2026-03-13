import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionControlOrchestrationHistoryStore,
  ensureMissionControlOrchestrationArtifactDir,
  resolveMissionControlOrchestrationArtifactPaths,
  type MissionControlOrchestrationHistoryStore,
} from './mission-control-orchestration-history-store.ts';
import {
  createMissionControlOrchestrationProjection,
  type MissionControlOrchestrationProjectionEngine,
} from './mission-control-orchestration-projection.ts';

function toMarkdownReport(input: {
  missionControlInterventionPlanId: string;
  status: unknown;
  interventionPlan: unknown;
  stabilizationStrategy: unknown;
  actions: unknown;
  queue: unknown;
  priority: unknown;
  history: unknown;
  report: unknown;
}): string {
  const sections: Array<{ title: string; value: unknown }> = [
    { title: 'Mission Control Orchestration Status', value: input.status },
    { title: 'Mission Control Intervention Plan', value: input.interventionPlan },
    { title: 'Mission Control Stabilization Strategy', value: input.stabilizationStrategy },
    { title: 'Mission Control Orchestration Actions', value: input.actions },
    { title: 'Mission Control Orchestration Queue', value: input.queue },
    { title: 'Mission Control Orchestration Priority', value: input.priority },
    { title: 'Mission Control Orchestration History', value: input.history },
    { title: 'Mission Control Orchestration Report', value: input.report },
  ];

  const lines = [
    '# Mission Control Orchestration Report',
    '',
    `Intervention Plan: ${input.missionControlInterventionPlanId}`,
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

export interface MissionControlOrchestrationMaterializationSummary {
  missionControlInterventionPlanId: string;
  statusPath: string;
  interventionPlanPath: string;
  stabilizationStrategyPath: string;
  actionsPath: string;
  queuePath: string;
  priorityPath: string;
  historyPath: string;
  reportPath: string;
  reportMarkdownPath: string;
}

export function createMissionControlOrchestrationMaterializer(options: {
  projection?: MissionControlOrchestrationProjectionEngine;
  historyStore?: MissionControlOrchestrationHistoryStore;
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
  const projection = options.projection ?? createMissionControlOrchestrationProjection({
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

  const historyStore = options.historyStore ?? createMissionControlOrchestrationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { missionControlInterventionPlanId: string }): MissionControlOrchestrationMaterializationSummary {
    const projected = projection.projectOne(input);

    ensureMissionControlOrchestrationArtifactDir({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveMissionControlOrchestrationArtifactPaths({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const status = projected.statusPreview;
    const interventionPlan = projected.interventionPlan;
    const stabilizationStrategy = projected.stabilizationStrategy;
    const actions = projected.actionItems;
    const queue = projected.orchestrationQueue;
    const priority = projected.priorityPosture;
    const history = historyStore.load({ missionControlInterventionPlanId: input.missionControlInterventionPlanId });
    const report = projected.reportPreview;

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(status)}\n`, 'utf8');
    fs.writeFileSync(paths.interventionPlanJsonPath, `${canonicalStringify(interventionPlan)}\n`, 'utf8');
    fs.writeFileSync(paths.stabilizationStrategyJsonPath, `${canonicalStringify(stabilizationStrategy)}\n`, 'utf8');
    fs.writeFileSync(paths.actionsJsonPath, `${canonicalStringify(actions)}\n`, 'utf8');
    fs.writeFileSync(paths.queueJsonPath, `${canonicalStringify(queue)}\n`, 'utf8');
    fs.writeFileSync(paths.priorityJsonPath, `${canonicalStringify(priority)}\n`, 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(report)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      status,
      interventionPlan,
      stabilizationStrategy,
      actions,
      queue,
      priority,
      history,
      report,
    }), 'utf8');

    return {
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      statusPath: paths.statusJsonPath,
      interventionPlanPath: paths.interventionPlanJsonPath,
      stabilizationStrategyPath: paths.stabilizationStrategyJsonPath,
      actionsPath: paths.actionsJsonPath,
      queuePath: paths.queueJsonPath,
      priorityPath: paths.priorityJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportJsonPath,
      reportMarkdownPath: paths.reportMarkdownPath,
    };
  }

  return {
    materializeOne,
  };
}

export type MissionControlOrchestrationMaterializer = ReturnType<typeof createMissionControlOrchestrationMaterializer>;
