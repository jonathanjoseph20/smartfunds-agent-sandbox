import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createActionPlanHistoryStore,
  ensureActionPlanArtifactDir,
  resolveActionPlanArtifactPaths,
  type ActionPlanHistoryStore,
} from './action-plan-history-store.ts';
import {
  createActionPlanProjection,
  type ActionPlanProjectionEngine,
} from './action-plan-projection.ts';
import type {
  ActionPlanProjection,
} from './action-plan-types.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Portfolio Action Orchestration Report',
    '',
    `${canonicalStringify(reportPreview)}`,
  ];

  return `${lines.join('\n')}\n`;
}

export interface MaterializedActionPlan {
  actionPlanId: string;
  statusPath: string;
  historyPath: string;
  reportPath: string;
  markdownPath: string;
}

export function createActionPlanMaterializer(options: {
  projection?: ActionPlanProjectionEngine;
  historyStore?: ActionPlanHistoryStore;
  actionPlanArtifactsRoot?: string;
  definitionsDir?: string;
  actionPlanDefinitionsDir?: string;
  portfolioActionDefinitionsDir?: string;
  portfolioDefinitionsDir?: string;
  marketSynthesisDefinitionsDir?: string;
  crossSwarmDefinitionsDir?: string;
  swarmDefinitionsDir?: string;
  teamDefinitionsDir?: string;
  cohortDefinitionsDir?: string;
  cohortProgramDefinitionsDir?: string;
  cohortArtifactsRoot?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  policyDefinitionsDir?: string;
  coordinationArtifactsRoot?: string;
  teamSwarmArtifactsRoot?: string;
  swarmArtifactsRoot?: string;
  crossSwarmArtifactsRoot?: string;
  marketSynthesisArtifactsRoot?: string;
  portfolioArtifactsRoot?: string;
  portfolioActionArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const definitionsDir = options.definitionsDir ?? options.actionPlanDefinitionsDir;

  const projection = options.projection ?? createActionPlanProjection({
    definitionsDir,
    portfolioActionDefinitionsDir: options.portfolioActionDefinitionsDir,
    portfolioDefinitionsDir: options.portfolioDefinitionsDir,
    marketSynthesisDefinitionsDir: options.marketSynthesisDefinitionsDir,
    crossSwarmDefinitionsDir: options.crossSwarmDefinitionsDir,
    swarmDefinitionsDir: options.swarmDefinitionsDir,
    teamDefinitionsDir: options.teamDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    policyDefinitionsDir: options.policyDefinitionsDir,
    coordinationArtifactsRoot: options.coordinationArtifactsRoot,
    teamSwarmArtifactsRoot: options.teamSwarmArtifactsRoot,
    swarmArtifactsRoot: options.swarmArtifactsRoot,
    crossSwarmArtifactsRoot: options.crossSwarmArtifactsRoot,
    marketSynthesisArtifactsRoot: options.marketSynthesisArtifactsRoot,
    portfolioArtifactsRoot: options.portfolioArtifactsRoot,
    portfolioActionArtifactsRoot: options.portfolioActionArtifactsRoot,
    actionPlanArtifactsRoot: options.actionPlanArtifactsRoot,
    now: options.now,
  });

  const historyStore = options.historyStore ?? createActionPlanHistoryStore({
    artifactsRoot: options.actionPlanArtifactsRoot,
  });

  function materializeProjection(input: { projection: ActionPlanProjection }): MaterializedActionPlan {
    ensureActionPlanArtifactDir({
      actionPlanId: input.projection.actionPlanId,
      rootDir: options.actionPlanArtifactsRoot,
    });

    const paths = resolveActionPlanArtifactPaths({
      actionPlanId: input.projection.actionPlanId,
      rootDir: options.actionPlanArtifactsRoot,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection.reportPreview), 'utf8');

    const history = historyStore.load(input.projection.actionPlanId);
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');

    return {
      actionPlanId: input.projection.actionPlanId,
      statusPath: paths.statusJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
    };
  }

  function materializeOne(actionPlanId: string): MaterializedActionPlan {
    const projected = projection.projectOne(actionPlanId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne,
  };
}

export type ActionPlanMaterializer = ReturnType<typeof createActionPlanMaterializer>;
