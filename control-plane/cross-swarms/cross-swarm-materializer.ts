import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  ensureCrossSwarmArtifactDir,
  resolveCrossSwarmArtifactPaths
} from './cross-swarm-history.ts';
import {
  createCrossSwarmStatusProjection,
  type CrossSwarmStatusProjectionEngine
} from './cross-swarm-status.ts';
import type { CrossSwarmProjection } from './cross-swarm-types.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Cross-Swarm Coordination Report',
    '',
    `${canonicalStringify(reportPreview)}`
  ];
  return `${lines.join('\n')}\n`;
}

export interface MaterializedCrossSwarm {
  crossSwarmId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
}

export function createCrossSwarmMaterializer(options: {
  projection?: CrossSwarmStatusProjectionEngine;
  crossSwarmArtifactsRoot?: string;
  definitionsDir?: string;
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
  now?: () => Date;
} = {}) {
  const projection = options.projection ?? createCrossSwarmStatusProjection({
    definitionsDir: options.definitionsDir,
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
    now: options.now
  });

  function materializeProjection(input: { projection: CrossSwarmProjection }): MaterializedCrossSwarm {
    ensureCrossSwarmArtifactDir({
      crossSwarmId: input.projection.crossSwarmId,
      rootDir: options.crossSwarmArtifactsRoot
    });

    const paths = resolveCrossSwarmArtifactPaths({
      crossSwarmId: input.projection.crossSwarmId,
      rootDir: options.crossSwarmArtifactsRoot
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection.reportPreview), 'utf8');

    return {
      crossSwarmId: input.projection.crossSwarmId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath
    };
  }

  function materializeOne(crossSwarmId: string): MaterializedCrossSwarm {
    const status = projection.projectOne(crossSwarmId);
    const paths = resolveCrossSwarmArtifactPaths({
      crossSwarmId,
      rootDir: options.crossSwarmArtifactsRoot
    });

    const projected: CrossSwarmProjection = {
      ...status,
      historySummary: {
        totalEvents: 0
      },
      artifactPaths: paths,
      statusPreview: {
        crossSwarmId: status.crossSwarmId,
        lifecycleState: status.lifecycleState,
        readinessState: status.readinessState,
        completion: status.completion,
        blockers: status.blockers,
        conflicts: status.conflicts,
        linkedSwarmIds: status.linkedSwarmIds
      },
      reportPreview: {
        crossSwarmId: status.crossSwarmId,
        displayName: status.displayName,
        groupType: status.groupType,
        linkedSwarms: status.linkedSwarms,
        lifecycleState: status.lifecycleState,
        readinessState: status.readinessState,
        completion: status.completion,
        blockers: status.blockers,
        conflicts: status.conflicts,
        strengths: status.strengths,
        limitations: status.limitations,
        rationale: status.rationale
      }
    };

    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne
  };
}

export type CrossSwarmMaterializer = ReturnType<typeof createCrossSwarmMaterializer>;
