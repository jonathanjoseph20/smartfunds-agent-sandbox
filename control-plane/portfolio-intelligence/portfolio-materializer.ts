import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  ensurePortfolioArtifactDir,
  resolvePortfolioArtifactPaths,
} from './portfolio-history-store.ts';
import {
  createPortfolioProjection,
  type PortfolioProjectionEngine,
} from './portfolio-projection.ts';
import type { PortfolioIntelligenceProjection } from './portfolio-types.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Portfolio Intelligence Report',
    '',
    `${canonicalStringify(reportPreview)}`
  ];

  return `${lines.join('\n')}\n`;
}

export interface MaterializedPortfolioIntelligence {
  portfolioId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
}

export function createPortfolioMaterializer(options: {
  projection?: PortfolioProjectionEngine;
  portfolioArtifactsRoot?: string;
  definitionsDir?: string;
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
  now?: () => Date;
} = {}) {
  const projection = options.projection ?? createPortfolioProjection({
    definitionsDir: options.definitionsDir ?? options.portfolioDefinitionsDir,
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
    now: options.now,
  });

  function materializeProjection(input: { projection: PortfolioIntelligenceProjection }): MaterializedPortfolioIntelligence {
    ensurePortfolioArtifactDir({
      portfolioId: input.projection.portfolioId,
      rootDir: options.portfolioArtifactsRoot,
    });

    const paths = resolvePortfolioArtifactPaths({
      portfolioId: input.projection.portfolioId,
      rootDir: options.portfolioArtifactsRoot,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection.reportPreview), 'utf8');

    return {
      portfolioId: input.projection.portfolioId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
    };
  }

  function materializeOne(portfolioId: string): MaterializedPortfolioIntelligence {
    const projected = projection.projectOne(portfolioId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne,
  };
}

export type PortfolioMaterializer = ReturnType<typeof createPortfolioMaterializer>;
