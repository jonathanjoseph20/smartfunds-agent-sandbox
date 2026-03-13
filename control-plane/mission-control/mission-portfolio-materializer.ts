import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionPortfolioHistoryStore,
  ensureMissionPortfolioArtifactDir,
  resolveMissionPortfolioArtifactPaths,
  type MissionPortfolioHistoryStore,
} from './mission-portfolio-history-store.ts';
import {
  createMissionPortfolioInspection,
  type MissionPortfolioInspection,
} from './mission-portfolio-inspection.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Mission Portfolio Report',
    '',
    canonicalStringify(reportPreview),
  ];

  return `${lines.join('\n')}\n`;
}

export interface MissionPortfolioMaterializationSummary {
  missionPortfolioId: string;
  statusPath: string;
  readinessPath: string;
  healthPath: string;
  governancePath: string;
  membershipPath: string;
  blockingPath: string;
  historyPath: string;
  reportPath: string;
  reportMarkdownPath: string;
}

export function createMissionPortfolioMaterializer(options: {
  inspection?: MissionPortfolioInspection;
  historyStore?: MissionPortfolioHistoryStore;
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
  const inspection = options.inspection ?? createMissionPortfolioInspection({
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

  const historyStore = options.historyStore ?? createMissionPortfolioHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function materializeOne(input: { missionPortfolioId: string }): MissionPortfolioMaterializationSummary {
    const evaluation = inspection.evaluateMissionPortfolio(input);
    const projected = evaluation.projection;

    ensureMissionPortfolioArtifactDir({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const paths = resolveMissionPortfolioArtifactPaths({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const readiness = inspection.inspectMissionPortfolioReadiness(input);
    const health = inspection.inspectMissionPortfolioHealth(input);
    const governance = inspection.inspectMissionPortfolioGovernancePosture(input);
    const membership = inspection.inspectMissionPortfolioMembership(input);
    const blocking = inspection.inspectMissionPortfolioBlocking(input);

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.readinessJsonPath, `${canonicalStringify(readiness)}\n`, 'utf8');
    fs.writeFileSync(paths.healthJsonPath, `${canonicalStringify(health)}\n`, 'utf8');
    fs.writeFileSync(paths.governanceJsonPath, `${canonicalStringify(governance)}\n`, 'utf8');
    fs.writeFileSync(paths.membershipJsonPath, `${canonicalStringify(membership)}\n`, 'utf8');
    fs.writeFileSync(paths.blockingJsonPath, `${canonicalStringify(blocking)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(projected.reportPreview), 'utf8');

    historyStore.append({
      missionPortfolioId: projected.missionPortfolioId,
      eventType: 'mission_portfolio_materialized',
      reasonTokens: ['mission_portfolio_artifacts_persisted'],
      payload: {
        missionPortfolioId: projected.missionPortfolioId,
        artifactPaths: {
          statusPath: paths.statusJsonPath,
          readinessPath: paths.readinessJsonPath,
          healthPath: paths.healthJsonPath,
          governancePath: paths.governanceJsonPath,
          membershipPath: paths.membershipJsonPath,
          blockingPath: paths.blockingJsonPath,
          historyPath: paths.historyJsonPath,
          reportPath: paths.reportJsonPath,
          reportMarkdownPath: paths.reportMarkdownPath,
        },
      },
    });

    const history = inspection.inspectMissionPortfolioHistory(input);
    historyStore.write(history);

    return {
      missionPortfolioId: projected.missionPortfolioId,
      statusPath: paths.statusJsonPath,
      readinessPath: paths.readinessJsonPath,
      healthPath: paths.healthJsonPath,
      governancePath: paths.governanceJsonPath,
      membershipPath: paths.membershipJsonPath,
      blockingPath: paths.blockingJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportJsonPath,
      reportMarkdownPath: paths.reportMarkdownPath,
    };
  }

  return {
    materializeOne,
  };
}

export type MissionPortfolioMaterializer = ReturnType<typeof createMissionPortfolioMaterializer>;
