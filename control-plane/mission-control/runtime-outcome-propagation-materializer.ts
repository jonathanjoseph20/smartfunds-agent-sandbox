import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createRuntimeOutcomePropagationHistoryStore,
  ensureRuntimeOutcomePropagationArtifactDir,
  resolveRuntimeOutcomePropagationArtifactPaths,
  type RuntimeOutcomePropagationHistoryStore,
} from './runtime-outcome-propagation-history-store.ts';
import {
  createRuntimeOutcomePropagationInspection,
  type RuntimeOutcomePropagationInspection,
} from './runtime-outcome-propagation-inspection.ts';
import {
  createRuntimeOutcomePropagationProjection,
  type RuntimeOutcomePropagationProjectionEngine,
} from './runtime-outcome-propagation-projection.ts';

function toMarkdownReport(input: {
  runtimeOutcomePropagationRecordId: string;
  status: unknown;
  activation: unknown;
  coordination: unknown;
  orchestration: unknown;
  portfolio: unknown;
  history: unknown;
  outcome: unknown;
  report: unknown;
}): string {
  const sections: Array<{ title: string; value: unknown }> = [
    { title: 'Runtime Outcome Propagation Status', value: input.status },
    { title: 'Activation Lifecycle Propagation', value: input.activation },
    { title: 'Execution Coordination Propagation', value: input.coordination },
    { title: 'Mission Orchestration Propagation', value: input.orchestration },
    { title: 'Mission Portfolio State Propagation', value: input.portfolio },
    { title: 'Runtime Outcome Propagation History', value: input.history },
    { title: 'Runtime Outcome Propagation Outcome', value: input.outcome },
    { title: 'Runtime Outcome Propagation Report', value: input.report },
  ];

  const lines = [
    '# Runtime Outcome Propagation Report',
    '',
    `Runtime Outcome Propagation Record: ${input.runtimeOutcomePropagationRecordId}`,
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

export interface RuntimeOutcomePropagationMaterializationSummary {
  runtimeOutcomePropagationRecordId: string;
  statusPath: string;
  activationPath: string;
  coordinationPath: string;
  orchestrationPath: string;
  portfolioPath: string;
  historyPath: string;
  outcomePath: string;
  reportPath: string;
  reportMarkdownPath: string;
}

export function createRuntimeOutcomePropagationMaterializer(options: {
  inspection?: RuntimeOutcomePropagationInspection;
  projection?: RuntimeOutcomePropagationProjectionEngine;
  historyStore?: RuntimeOutcomePropagationHistoryStore;
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
  const projection = options.projection ?? createRuntimeOutcomePropagationProjection({
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

  const inspection = options.inspection ?? createRuntimeOutcomePropagationInspection({
    projection,
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createRuntimeOutcomePropagationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { runtimeOutcomePropagationRecordId: string }): RuntimeOutcomePropagationMaterializationSummary {
    const projected = projection.projectOne(input);

    ensureRuntimeOutcomePropagationArtifactDir({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveRuntimeOutcomePropagationArtifactPaths({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const status = projected.status;
    const activation = inspection.inspectActivationPropagation(input);
    const coordination = inspection.inspectCoordinationPropagation(input);
    const orchestration = inspection.inspectOrchestrationPropagation(input);
    const portfolio = inspection.inspectPortfolioPropagation(input);
    const history = historyStore.load(input);
    const outcome = projected.outcome;
    const report = projected.reportPreview;

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(status)}\n`, 'utf8');
    fs.writeFileSync(paths.activationLifecycleJsonPath, `${canonicalStringify(activation)}\n`, 'utf8');
    fs.writeFileSync(paths.executionCoordinationJsonPath, `${canonicalStringify(coordination)}\n`, 'utf8');
    fs.writeFileSync(paths.missionOrchestrationJsonPath, `${canonicalStringify(orchestration)}\n`, 'utf8');
    fs.writeFileSync(paths.missionPortfolioJsonPath, `${canonicalStringify(portfolio)}\n`, 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.outcomeJsonPath, `${canonicalStringify(outcome)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(report)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      status,
      activation,
      coordination,
      orchestration,
      portfolio,
      history,
      outcome,
      report,
    }), 'utf8');

    return {
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      statusPath: paths.statusJsonPath,
      activationPath: paths.activationLifecycleJsonPath,
      coordinationPath: paths.executionCoordinationJsonPath,
      orchestrationPath: paths.missionOrchestrationJsonPath,
      portfolioPath: paths.missionPortfolioJsonPath,
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

export type RuntimeOutcomePropagationMaterializer = ReturnType<typeof createRuntimeOutcomePropagationMaterializer>;
