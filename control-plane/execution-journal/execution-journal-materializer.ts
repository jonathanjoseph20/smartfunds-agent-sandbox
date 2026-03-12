import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createExecutionJournalHistoryStore,
  ensureExecutionJournalArtifactDir,
  resolveExecutionJournalArtifactPaths,
  type ExecutionJournalHistoryStore,
} from './execution-journal-history-store.ts';
import {
  createExecutionJournalProjection,
  type ExecutionJournalProjectionEngine,
} from './execution-journal-projection.ts';
import type { ExecutionJournalMaterializationSummary } from './execution-journal-types.ts';

function toMarkdownReport(input: {
  executionJournalId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  attemptIndex: number;
  journalState: string;
  eventCount: number;
  latestEventType?: string;
  blockers: string[];
  limitations: string[];
}): string {
  const lines = [
    '# Mission Execution Journal Report',
    '',
    `Execution Journal: ${input.executionJournalId}`,
    `Execution Attempt: ${input.executionAttemptId}`,
    `Runtime Envelope: ${input.runtimeEnvelopeId}`,
    `Execution Contract: ${input.executionContractId}`,
    `Mission: ${input.missionId}`,
    `Attempt Index: ${input.attemptIndex}`,
    `Journal State: ${input.journalState}`,
    `Event Count: ${input.eventCount}`,
    `Latest Event Type: ${input.latestEventType ?? 'none'}`,
    '',
    '## Summary',
    `- blockers: ${input.blockers.join(', ') || 'none'}`,
    `- limitations: ${input.limitations.join(', ') || 'none'}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify({
      executionJournalId: input.executionJournalId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      attemptIndex: input.attemptIndex,
      journalState: input.journalState,
      eventCount: input.eventCount,
      latestEventType: input.latestEventType ?? null,
      blockers: input.blockers,
      limitations: input.limitations,
    }),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function appendMaterializedEvent(input: {
  executionJournalId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  historyStore: ExecutionJournalHistoryStore;
}): void {
  input.historyStore.append({
    executionJournalId: input.executionJournalId,
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: 'journal_materialized',
    eventPayload: {
      executionJournalId: input.executionJournalId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
    },
    reasonTokens: ['execution_journal_projection_materialized'],
  });
}

export function createExecutionJournalMaterializer(options: {
  projection?: ExecutionJournalProjectionEngine;
  historyStore?: ExecutionJournalHistoryStore;
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
} = {}) {
  const projection = options.projection ?? createExecutionJournalProjection({
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
  });

  const historyStore = options.historyStore ?? createExecutionJournalHistoryStore({
    artifactsRoot: options.executionJournalArtifactsRoot,
  });

  function materializeOne(input: { executionAttemptId: string }): ExecutionJournalMaterializationSummary {
    const projectedInitial = projection.projectOne(input);

    ensureExecutionJournalArtifactDir({
      executionJournalId: projectedInitial.executionJournalId,
      rootDir: options.executionJournalArtifactsRoot,
    });

    appendMaterializedEvent({
      executionJournalId: projectedInitial.executionJournalId,
      executionAttemptId: projectedInitial.executionAttemptId,
      runtimeEnvelopeId: projectedInitial.runtimeEnvelopeId,
      executionContractId: projectedInitial.executionContractId,
      missionId: projectedInitial.missionId,
      historyStore,
    });

    const projected = projection.projectOne(input);

    const paths = resolveExecutionJournalArtifactPaths({
      executionJournalId: projected.executionJournalId,
      rootDir: options.executionJournalArtifactsRoot,
    });

    const history = historyStore.load({
      executionJournalId: projected.executionJournalId,
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      executionJournalId: projected.executionJournalId,
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      attemptIndex: projected.attemptIndex,
      journalState: projected.journalState,
      eventCount: projected.eventCount,
      latestEventType: projected.latestEventType,
      blockers: projected.blockers,
      limitations: projected.limitations,
    }), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.eventsJsonPath, `${canonicalStringify(projected.events)}\n`, 'utf8');

    return {
      executionJournalId: projected.executionJournalId,
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      eventsPath: paths.eventsJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type ExecutionJournalMaterializer = ReturnType<typeof createExecutionJournalMaterializer>;
