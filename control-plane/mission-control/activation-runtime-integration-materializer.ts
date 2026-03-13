import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createActivationRuntimeIntegrationHistoryStore,
  ensureActivationRuntimeIntegrationArtifactDir,
  resolveActivationRuntimeIntegrationArtifactPaths,
  type ActivationRuntimeIntegrationHistoryStore,
} from './activation-runtime-integration-history-store.ts';
import {
  createActivationRuntimeIntegrationInspection,
  type ActivationRuntimeIntegrationInspection,
} from './activation-runtime-integration-inspection.ts';
import {
  createActivationRuntimeIntegrationProjection,
  type ActivationRuntimeIntegrationProjectionEngine,
} from './activation-runtime-integration-projection.ts';

function toMarkdownReport(input: {
  activationDispatchAttemptId: string;
  dispatchStatus: unknown;
  dispatchQueue: unknown;
  runtimeLinks: unknown;
  feedbackIngestion: unknown;
  reconciliation: unknown;
  history: unknown;
  outcome: unknown;
  report: unknown;
}): string {
  const sections: Array<{ title: string; value: unknown }> = [
    { title: 'Activation Runtime Dispatch Status', value: input.dispatchStatus },
    { title: 'Activation Runtime Dispatch Queue', value: input.dispatchQueue },
    { title: 'Activation Runtime Links', value: input.runtimeLinks },
    { title: 'Activation Runtime Feedback Ingestion', value: input.feedbackIngestion },
    { title: 'Activation Runtime Reconciliation', value: input.reconciliation },
    { title: 'Activation Runtime Integration History', value: input.history },
    { title: 'Activation Runtime Outcome', value: input.outcome },
    { title: 'Activation Runtime Report', value: input.report },
  ];

  const lines = [
    '# Activation Runtime Integration Report',
    '',
    `Activation Dispatch Attempt: ${input.activationDispatchAttemptId}`,
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

export interface ActivationRuntimeIntegrationMaterializationSummary {
  activationDispatchAttemptId: string;
  dispatchStatusPath: string;
  dispatchQueuePath: string;
  runtimeLinksPath: string;
  feedbackIngestionPath: string;
  reconciliationPath: string;
  historyPath: string;
  outcomePath: string;
  reportPath: string;
  reportMarkdownPath: string;
}

export function createActivationRuntimeIntegrationMaterializer(options: {
  inspection?: ActivationRuntimeIntegrationInspection;
  projection?: ActivationRuntimeIntegrationProjectionEngine;
  historyStore?: ActivationRuntimeIntegrationHistoryStore;
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
  const projection = options.projection ?? createActivationRuntimeIntegrationProjection({
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

  const inspection = options.inspection ?? createActivationRuntimeIntegrationInspection({
    projection,
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createActivationRuntimeIntegrationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { activationDispatchAttemptId: string }): ActivationRuntimeIntegrationMaterializationSummary {
    const projected = projection.projectOne(input);

    ensureActivationRuntimeIntegrationArtifactDir({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveActivationRuntimeIntegrationArtifactPaths({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const dispatchStatus = projected.status;
    const dispatchQueue = inspection.inspectDispatchQueue(input);
    const runtimeLinks = inspection.inspectRuntimeLinks(input);
    const feedbackIngestion = inspection.inspectFeedbackRecords(input);
    const reconciliation = inspection.inspectReconciliation(input);
    const history = historyStore.load(input);
    const outcome = inspection.inspectAttemptOutcome(input);
    const report = projected.reportPreview;

    fs.writeFileSync(paths.dispatchStatusJsonPath, `${canonicalStringify(dispatchStatus)}\n`, 'utf8');
    fs.writeFileSync(paths.dispatchQueueJsonPath, `${canonicalStringify(dispatchQueue)}\n`, 'utf8');
    fs.writeFileSync(paths.runtimeLinksJsonPath, `${canonicalStringify(runtimeLinks)}\n`, 'utf8');
    fs.writeFileSync(paths.feedbackIngestionJsonPath, `${canonicalStringify(feedbackIngestion)}\n`, 'utf8');
    fs.writeFileSync(paths.reconciliationJsonPath, `${canonicalStringify(reconciliation)}\n`, 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.outcomeJsonPath, `${canonicalStringify(outcome)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(report)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      dispatchStatus,
      dispatchQueue,
      runtimeLinks,
      feedbackIngestion,
      reconciliation,
      history,
      outcome,
      report,
    }), 'utf8');

    return {
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      dispatchStatusPath: paths.dispatchStatusJsonPath,
      dispatchQueuePath: paths.dispatchQueueJsonPath,
      runtimeLinksPath: paths.runtimeLinksJsonPath,
      feedbackIngestionPath: paths.feedbackIngestionJsonPath,
      reconciliationPath: paths.reconciliationJsonPath,
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

export type ActivationRuntimeIntegrationMaterializer = ReturnType<typeof createActivationRuntimeIntegrationMaterializer>;
