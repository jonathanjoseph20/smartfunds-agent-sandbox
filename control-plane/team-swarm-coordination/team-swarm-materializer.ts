import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  ensureTeamSwarmArtifactDir,
  resolveTeamSwarmArtifactPaths
} from './team-swarm-history-store.ts';
import {
  createTeamSwarmProjection,
  type TeamSwarmProjectionEngine
} from './team-swarm-projection.ts';
import type { TeamSwarmProjection } from './team-swarm-types.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Team Swarm Coordination Report',
    '',
    `${canonicalStringify(reportPreview)}`
  ];
  return `${lines.join('\n')}\n`;
}

export interface MaterializedTeamSwarm {
  teamId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
}

export function createTeamSwarmMaterializer(options: {
  projection?: TeamSwarmProjectionEngine;
  teamSwarmArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  swarmDefinitionsDir?: string;
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
  swarmArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const projection = options.projection ?? createTeamSwarmProjection({
    teamDefinitionsDir: options.teamDefinitionsDir,
    swarmDefinitionsDir: options.swarmDefinitionsDir,
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
    swarmArtifactsRoot: options.swarmArtifactsRoot,
    teamSwarmArtifactsRoot: options.teamSwarmArtifactsRoot,
    now: options.now
  });

  function materializeProjection(input: { projection: TeamSwarmProjection }): MaterializedTeamSwarm {
    ensureTeamSwarmArtifactDir({
      teamId: input.projection.teamId,
      rootDir: options.teamSwarmArtifactsRoot
    });

    const paths = resolveTeamSwarmArtifactPaths({
      teamId: input.projection.teamId,
      rootDir: options.teamSwarmArtifactsRoot
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection.reportPreview), 'utf8');

    return {
      teamId: input.projection.teamId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath
    };
  }

  function materializeOne(teamId: string): MaterializedTeamSwarm {
    const projected = projection.projectOne(teamId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne
  };
}

export type TeamSwarmMaterializer = ReturnType<typeof createTeamSwarmMaterializer>;
