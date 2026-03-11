import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createPortfolioActionHistoryStore,
  ensurePortfolioActionArtifactDir,
  resolvePortfolioActionArtifactPaths,
  type PortfolioActionHistoryStore,
} from './portfolio-action-history-store.ts';
import {
  createPortfolioActionInspection,
  type PortfolioActionInspection,
} from './portfolio-action-inspection.ts';
import type { PortfolioActionProjection } from './portfolio-action-types.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Portfolio Action Routing Intelligence Report',
    '',
    `${canonicalStringify(reportPreview)}`,
  ];

  return `${lines.join('\n')}\n`;
}

export interface MaterializedPortfolioAction {
  actionId: string;
  statusPath: string;
  historyPath: string;
  reportPath: string;
  markdownPath: string;
}

export function createPortfolioActionMaterializer(options: {
  inspection?: PortfolioActionInspection;
  historyStore?: PortfolioActionHistoryStore;
  portfolioActionArtifactsRoot?: string;
  definitionsDir?: string;
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
  now?: () => Date;
} = {}) {
  const inspection = options.inspection ?? createPortfolioActionInspection({
    definitionsDir: options.definitionsDir ?? options.portfolioActionDefinitionsDir,
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
    now: options.now,
  });

  const historyStore = options.historyStore ?? createPortfolioActionHistoryStore({
    artifactsRoot: options.portfolioActionArtifactsRoot,
  });

  function materializeProjection(input: { projection: PortfolioActionProjection }): MaterializedPortfolioAction {
    ensurePortfolioActionArtifactDir({
      actionId: input.projection.actionId,
      rootDir: options.portfolioActionArtifactsRoot,
    });

    const paths = resolvePortfolioActionArtifactPaths({
      actionId: input.projection.actionId,
      rootDir: options.portfolioActionArtifactsRoot,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection.reportPreview), 'utf8');

    const history = historyStore.load(input.projection.actionId);
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');

    return {
      actionId: input.projection.actionId,
      statusPath: paths.statusJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
    };
  }

  function materializeOne(actionId: string): MaterializedPortfolioAction {
    const projected = inspection.inspectPortfolioAction(actionId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne,
  };
}

export type PortfolioActionMaterializer = ReturnType<typeof createPortfolioActionMaterializer>;
