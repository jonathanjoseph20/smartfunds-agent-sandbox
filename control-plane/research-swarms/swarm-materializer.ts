import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  ensureSwarmArtifactDir,
  resolveSwarmArtifactPaths
} from './swarm-history-store.ts';
import {
  createSwarmProjection,
  type SwarmProjectionEngine
} from './swarm-projection.ts';
import type { SwarmProjection } from './swarm-types.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Research Swarm Report',
    '',
    `${canonicalStringify(reportPreview)}`
  ];
  return `${lines.join('\n')}\n`;
}

export interface MaterializedSwarm {
  swarmId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
}

export function createSwarmMaterializer(options: {
  projection?: SwarmProjectionEngine;
  swarmArtifactsRoot?: string;
  definitionsDir?: string;
  investigationDefinitionsDir?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  signalsRootDir?: string;
} = {}) {
  const projection = options.projection ?? createSwarmProjection({
    definitionsDir: options.definitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    signalsRootDir: options.signalsRootDir,
    swarmArtifactsRoot: options.swarmArtifactsRoot
  });

  function materializeProjection(input: { projection: SwarmProjection }): MaterializedSwarm {
    ensureSwarmArtifactDir({
      swarmId: input.projection.swarmId,
      rootDir: options.swarmArtifactsRoot
    });

    const paths = resolveSwarmArtifactPaths({
      swarmId: input.projection.swarmId,
      rootDir: options.swarmArtifactsRoot
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection.reportPreview), 'utf8');

    return {
      swarmId: input.projection.swarmId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath
    };
  }

  function materializeOne(swarmId: string): MaterializedSwarm {
    const projected = projection.projectOne(swarmId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne
  };
}

export type SwarmMaterializer = ReturnType<typeof createSwarmMaterializer>;
