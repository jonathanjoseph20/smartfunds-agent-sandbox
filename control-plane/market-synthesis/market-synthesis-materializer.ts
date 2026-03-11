import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  ensureMarketSynthesisArtifactDir,
  resolveMarketSynthesisArtifactPaths,
} from './market-synthesis-history-store.ts';
import {
  createMarketSynthesisProjection,
  type MarketSynthesisProjectionEngine,
} from './market-synthesis-projection.ts';
import type { MarketSynthesisProjection } from './market-synthesis-types.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Market Intelligence Synthesis Report',
    '',
    `${canonicalStringify(reportPreview)}`
  ];

  return `${lines.join('\n')}\n`;
}

export interface MaterializedMarketSynthesis {
  marketSynthesisId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
}

export function createMarketSynthesisMaterializer(options: {
  projection?: MarketSynthesisProjectionEngine;
  marketSynthesisArtifactsRoot?: string;
  definitionsDir?: string;
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
  now?: () => Date;
} = {}) {
  const projection = options.projection ?? createMarketSynthesisProjection({
    definitionsDir: options.definitionsDir ?? options.marketSynthesisDefinitionsDir,
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
    now: options.now,
  });

  function materializeProjection(input: { projection: MarketSynthesisProjection }): MaterializedMarketSynthesis {
    ensureMarketSynthesisArtifactDir({
      marketSynthesisId: input.projection.marketSynthesisId,
      rootDir: options.marketSynthesisArtifactsRoot,
    });

    const paths = resolveMarketSynthesisArtifactPaths({
      marketSynthesisId: input.projection.marketSynthesisId,
      rootDir: options.marketSynthesisArtifactsRoot,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection.reportPreview), 'utf8');

    return {
      marketSynthesisId: input.projection.marketSynthesisId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
    };
  }

  function materializeOne(marketSynthesisId: string): MaterializedMarketSynthesis {
    const projected = projection.projectOne(marketSynthesisId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne,
  };
}

export type MarketSynthesisMaterializer = ReturnType<typeof createMarketSynthesisMaterializer>;
