import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionExecutionCoordinationHistoryStore,
  ensureMissionExecutionCoordinationArtifactDir,
  resolveMissionExecutionCoordinationArtifactPaths,
  type MissionExecutionCoordinationHistoryStore,
} from './mission-execution-coordination-history-store.ts';
import {
  createMissionExecutionCoordinationProjection,
  type MissionExecutionCoordinationProjectionEngine,
} from './mission-execution-coordination-projection.ts';

function toMarkdownReport(input: {
  missionExecutionCoordinationPlanId: string;
  status: unknown;
  intents: unknown;
  requests: unknown;
  feedbackLinks: unknown;
  history: unknown;
  outcome: unknown;
  report: unknown;
}): string {
  const sections: Array<{ title: string; value: unknown }> = [
    { title: 'Mission Execution Coordination Status', value: input.status },
    { title: 'Mission Execution Intents', value: input.intents },
    { title: 'Mission Execution Requests', value: input.requests },
    { title: 'Mission Execution Feedback Links', value: input.feedbackLinks },
    { title: 'Mission Execution Coordination History', value: input.history },
    { title: 'Mission Execution Coordination Outcome', value: input.outcome },
    { title: 'Mission Execution Coordination Report', value: input.report },
  ];

  const lines = [
    '# Mission Execution Coordination Report',
    '',
    `Coordination Plan: ${input.missionExecutionCoordinationPlanId}`,
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

export interface MissionExecutionCoordinationMaterializationSummary {
  missionExecutionCoordinationPlanId: string;
  statusPath: string;
  intentsPath: string;
  requestsPath: string;
  feedbackLinksPath: string;
  historyPath: string;
  outcomePath: string;
  reportPath: string;
  reportMarkdownPath: string;
}

export function createMissionExecutionCoordinationMaterializer(options: {
  projection?: MissionExecutionCoordinationProjectionEngine;
  historyStore?: MissionExecutionCoordinationHistoryStore;
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
  const projection = options.projection ?? createMissionExecutionCoordinationProjection({
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

  const historyStore = options.historyStore ?? createMissionExecutionCoordinationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { missionExecutionCoordinationPlanId: string }): MissionExecutionCoordinationMaterializationSummary {
    const projected = projection.projectOne(input);

    ensureMissionExecutionCoordinationArtifactDir({
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveMissionExecutionCoordinationArtifactPaths({
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const status = projected.status;
    const intents = projected.executionIntentSummaries;
    const requests = projected.executionRequestSummaries;
    const feedbackLinks = projected.feedbackLinkSummaries;
    const history = historyStore.load({ missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId });
    const outcome = projected.outcome;
    const report = projected.reportPreview;

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(status)}\n`, 'utf8');
    fs.writeFileSync(paths.intentsJsonPath, `${canonicalStringify(intents)}\n`, 'utf8');
    fs.writeFileSync(paths.requestsJsonPath, `${canonicalStringify(requests)}\n`, 'utf8');
    fs.writeFileSync(paths.feedbackLinksJsonPath, `${canonicalStringify(feedbackLinks)}\n`, 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.outcomeJsonPath, `${canonicalStringify(outcome)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(report)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      status,
      intents,
      requests,
      feedbackLinks,
      history,
      outcome,
      report,
    }), 'utf8');

    return {
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      statusPath: paths.statusJsonPath,
      intentsPath: paths.intentsJsonPath,
      requestsPath: paths.requestsJsonPath,
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

export type MissionExecutionCoordinationMaterializer = ReturnType<typeof createMissionExecutionCoordinationMaterializer>;
