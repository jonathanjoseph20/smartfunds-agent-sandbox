import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createResearchTeamHistoryStore,
  ensureResearchTeamArtifactDir,
  resolveResearchTeamArtifactPaths,
  type ResearchTeamHistoryStore
} from './research-team-history.ts';
import {
  createResearchTeamProjection,
  type ResearchTeamProjectionEngine
} from './research-team-projection.ts';
import type { ResearchTeamHistory, ResearchTeamProjection } from './research-team-types.ts';

function toMarkdownReport(projection: ResearchTeamProjection, history: ResearchTeamHistory): string {
  const lines = [
    '# Bounded Research Team Report',
    '',
    `${canonicalStringify({
      team: projection.team,
      status: projection.status,
      attachments: projection.attachments,
      linkedPrograms: projection.linkedPrograms,
      linkedInvestigations: projection.linkedInvestigations,
      linkedSyntheses: projection.linkedSyntheses,
      history
    })}`
  ];
  return `${lines.join('\n')}\n`;
}

export interface MaterializedResearchTeam {
  teamId: string;
  statusPath: string;
  historyPath: string;
  reportPath: string;
}

export function createResearchTeamMaterializer(options: {
  projection?: ResearchTeamProjectionEngine;
  historyStore?: ResearchTeamHistoryStore;
  artifactsRoot?: string;
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
  now?: () => Date;
} = {}) {
  const projection = options.projection ?? createResearchTeamProjection({
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
    now: options.now
  });
  const historyStore = options.historyStore ?? createResearchTeamHistoryStore({
    artifactsRoot: options.artifactsRoot
  });

  function materializeProjection(input: {
    projection: ResearchTeamProjection;
    history?: ResearchTeamHistory;
  }): MaterializedResearchTeam {
    ensureResearchTeamArtifactDir({
      teamId: input.projection.team.teamId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveResearchTeamArtifactPaths({
      teamId: input.projection.team.teamId,
      rootDir: options.artifactsRoot
    });

    const history = input.history ?? historyStore.load(input.projection.team.teamId);

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.status)}\n`, 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection, history), 'utf8');

    return {
      teamId: input.projection.team.teamId,
      statusPath: paths.statusJsonPath,
      historyPath: paths.historyJsonPath,
      reportPath: paths.reportMarkdownPath
    };
  }

  function materializeOne(teamId: string): MaterializedResearchTeam {
    const projected = projection.projectOne(teamId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne
  };
}

export type ResearchTeamMaterializer = ReturnType<typeof createResearchTeamMaterializer>;
