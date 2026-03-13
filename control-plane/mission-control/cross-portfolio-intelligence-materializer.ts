import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createCrossPortfolioIntelligenceHistoryStore,
  ensureCrossPortfolioIntelligenceArtifactDir,
  resolveCrossPortfolioIntelligenceArtifactPaths,
  type CrossPortfolioIntelligenceHistoryStore,
} from './cross-portfolio-intelligence-history-store.ts';
import {
  createCrossPortfolioMissionIntelligenceProjection,
  type CrossPortfolioMissionIntelligenceProjectionEngine,
} from './cross-portfolio-intelligence-projection.ts';

function toMarkdownReport(input: {
  setId: string;
  status: unknown;
  sharedDependencies: unknown;
  blockingClusters: unknown;
  escalationPatterns: unknown;
  risk: unknown;
  readiness: unknown;
  history: unknown;
}): string {
  const sections: Array<{ title: string; value: unknown }> = [
    { title: 'Cross-Portfolio Intelligence Status', value: input.status },
    { title: 'Cross-Portfolio Shared Dependencies', value: input.sharedDependencies },
    { title: 'Cross-Portfolio Blocking Clusters', value: input.blockingClusters },
    { title: 'Cross-Portfolio Escalation Patterns', value: input.escalationPatterns },
    { title: 'Cross-Portfolio Systemic Risk', value: input.risk },
    { title: 'Cross-Portfolio Readiness', value: input.readiness },
    { title: 'Cross-Portfolio Intelligence History', value: input.history },
  ];

  const lines = [
    '# Cross-Portfolio Mission Intelligence Report',
    '',
    `Intelligence Set: ${input.setId}`,
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

export interface CrossPortfolioMissionIntelligenceMaterializationSummary {
  crossPortfolioMissionIntelligenceSetId: string;
  statusPath: string;
  sharedDependenciesPath: string;
  blockingClustersPath: string;
  escalationPatternsPath: string;
  riskPath: string;
  readinessPath: string;
  historyPath: string;
  reportPath: string;
  reportMarkdownPath: string;
}

export function createCrossPortfolioMissionIntelligenceMaterializer(options: {
  projection?: CrossPortfolioMissionIntelligenceProjectionEngine;
  historyStore?: CrossPortfolioIntelligenceHistoryStore;
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
  const projection = options.projection ?? createCrossPortfolioMissionIntelligenceProjection({
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

  const historyStore = options.historyStore ?? createCrossPortfolioIntelligenceHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { crossPortfolioMissionIntelligenceSetId: string }): CrossPortfolioMissionIntelligenceMaterializationSummary {
    const projected = projection.projectOne(input);

    ensureCrossPortfolioIntelligenceArtifactDir({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveCrossPortfolioIntelligenceArtifactPaths({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const status = projected.statusPreview;
    const sharedDependencies = projected.sharedDependencies;
    const blockingClusters = projected.systemicBlockingClusters;
    const escalationPatterns = projected.escalationPatterns;
    const risk = {
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      systemicRiskPosture: projected.systemicRiskPosture,
      intelligenceOutcome: projected.intelligenceOutcome,
    };
    const readiness = {
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      readinessPosture: projected.readinessPosture,
      intelligenceOutcome: projected.intelligenceOutcome,
    };
    const history = historyStore.load({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(status)}\n`, 'utf8');
    fs.writeFileSync(paths.sharedDependenciesJsonPath, `${canonicalStringify(sharedDependencies)}\n`, 'utf8');
    fs.writeFileSync(paths.blockingClustersJsonPath, `${canonicalStringify(blockingClusters)}\n`, 'utf8');
    fs.writeFileSync(paths.escalationPatternsJsonPath, `${canonicalStringify(escalationPatterns)}\n`, 'utf8');
    fs.writeFileSync(paths.riskJsonPath, `${canonicalStringify(risk)}\n`, 'utf8');
    fs.writeFileSync(paths.readinessJsonPath, `${canonicalStringify(readiness)}\n`, 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      setId: input.crossPortfolioMissionIntelligenceSetId,
      status,
      sharedDependencies,
      blockingClusters,
      escalationPatterns,
      risk,
      readiness,
      history,
    }), 'utf8');

    return {
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      statusPath: paths.statusJsonPath,
      sharedDependenciesPath: paths.sharedDependenciesJsonPath,
      blockingClustersPath: paths.blockingClustersJsonPath,
      escalationPatternsPath: paths.escalationPatternsJsonPath,
      riskPath: paths.riskJsonPath,
      readinessPath: paths.readinessJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportJsonPath,
      reportMarkdownPath: paths.reportMarkdownPath,
    };
  }

  return {
    materializeOne,
  };
}

export type CrossPortfolioMissionIntelligenceMaterializer = ReturnType<typeof createCrossPortfolioMissionIntelligenceMaterializer>;
