import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionExecutionActivationHistoryStore,
  ensureMissionExecutionActivationArtifactDir,
  resolveMissionExecutionActivationArtifactPaths,
  type MissionExecutionActivationHistoryStore,
} from './mission-execution-activation-history-store.ts';
import {
  createMissionExecutionActivationInspection,
  type MissionExecutionActivationInspection,
} from './mission-execution-activation-inspection.ts';
import {
  createMissionExecutionActivationProjection,
  type MissionExecutionActivationProjectionEngine,
} from './mission-execution-activation-projection.ts';

function toMarkdownReport(input: {
  executionActivationRecordId: string;
  status: unknown;
  mapping: unknown;
  eligibility: unknown;
  queue: unknown;
  feedbackLinks: unknown;
  history: unknown;
  outcome: unknown;
  report: unknown;
}): string {
  const sections: Array<{ title: string; value: unknown }> = [
    { title: 'Mission Execution Activation Status', value: input.status },
    { title: 'Mission Execution Activation Mapping', value: input.mapping },
    { title: 'Mission Execution Activation Eligibility', value: input.eligibility },
    { title: 'Mission Execution Activation Queue', value: input.queue },
    { title: 'Mission Execution Activation Feedback Links', value: input.feedbackLinks },
    { title: 'Mission Execution Activation History', value: input.history },
    { title: 'Mission Execution Activation Outcome', value: input.outcome },
    { title: 'Mission Execution Activation Report', value: input.report },
  ];

  const lines = [
    '# Mission Execution Activation Report',
    '',
    `Activation Record: ${input.executionActivationRecordId}`,
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

export interface MissionExecutionActivationMaterializationSummary {
  executionActivationRecordId: string;
  statusPath: string;
  mappingPath: string;
  eligibilityPath: string;
  queuePath: string;
  feedbackLinksPath: string;
  historyPath: string;
  outcomePath: string;
  reportPath: string;
  reportMarkdownPath: string;
}

export function createMissionExecutionActivationMaterializer(options: {
  inspection?: MissionExecutionActivationInspection;
  projection?: MissionExecutionActivationProjectionEngine;
  historyStore?: MissionExecutionActivationHistoryStore;
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
  const projection = options.projection ?? createMissionExecutionActivationProjection({
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

  const inspection = options.inspection ?? createMissionExecutionActivationInspection({
    projection,
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionExecutionActivationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { executionActivationRecordId: string }): MissionExecutionActivationMaterializationSummary {
    const projected = projection.projectOne(input);

    ensureMissionExecutionActivationArtifactDir({
      executionActivationRecordId: input.executionActivationRecordId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveMissionExecutionActivationArtifactPaths({
      executionActivationRecordId: input.executionActivationRecordId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const status = inspection.inspectActivationStatus(input);
    const mapping = inspection.inspectRequestActivationMappings(input);
    const eligibility = inspection.inspectActivationEligibility(input);
    const queue = inspection.inspectActivationQueue(input);
    const feedbackLinks = inspection.inspectActivationFeedbackLinks(input);
    const history = historyStore.load(input);
    const outcome = inspection.inspectActivationOutcome(input);
    const report = projected.reportPreview;

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(status)}\n`, 'utf8');
    fs.writeFileSync(paths.mappingJsonPath, `${canonicalStringify(mapping)}\n`, 'utf8');
    fs.writeFileSync(paths.eligibilityJsonPath, `${canonicalStringify(eligibility)}\n`, 'utf8');
    fs.writeFileSync(paths.queueJsonPath, `${canonicalStringify(queue)}\n`, 'utf8');
    fs.writeFileSync(paths.feedbackLinksJsonPath, `${canonicalStringify(feedbackLinks)}\n`, 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.outcomeJsonPath, `${canonicalStringify(outcome)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(report)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      executionActivationRecordId: input.executionActivationRecordId,
      status,
      mapping,
      eligibility,
      queue,
      feedbackLinks,
      history,
      outcome,
      report,
    }), 'utf8');

    return {
      executionActivationRecordId: input.executionActivationRecordId,
      statusPath: paths.statusJsonPath,
      mappingPath: paths.mappingJsonPath,
      eligibilityPath: paths.eligibilityJsonPath,
      queuePath: paths.queueJsonPath,
      feedbackLinksPath: paths.feedbackLinksJsonPath,
      historyPath: paths.historyJsonPath,
      outcomePath: paths.outcomeJsonPath,
      reportPath: paths.reportJsonPath,
      reportMarkdownPath: paths.reportMarkdownPath,
    };
  }

  return {
    materializeOne,
  };
}

export type MissionExecutionActivationMaterializer = ReturnType<typeof createMissionExecutionActivationMaterializer>;
