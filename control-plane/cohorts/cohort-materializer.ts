import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import { createCohortProjection, type CohortProjectionEngine, type CohortProjectionResult } from './cohort-projection.ts';
import { ensureCohortArtifactDir, resolveCohortArtifactPaths } from './cohort-runtime-paths.ts';

function toMarkdownReport(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Research Cohort Report',
    '',
    `${canonicalStringify(reportPreview)}`
  ];
  return `${lines.join('\n')}\n`;
}

export interface MaterializedCohort {
  cohortId: string;
  reportPath: string;
}

export function createCohortMaterializer(options: {
  projection?: CohortProjectionEngine;
  cohortArtifactsRoot?: string;
  definitionsDir?: string;
  investigationsRootDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  investigationDefinitionsDir?: string;
  investigationArtifactsRoot?: string;
  synthesisArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createCohortProjection({
    definitionsDir: options.definitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });

  function materializeProjection(input: { projection: CohortProjectionResult }): MaterializedCohort {
    ensureCohortArtifactDir({ cohortId: input.projection.cohortId, rootDir: options.cohortArtifactsRoot });
    const paths = resolveCohortArtifactPaths({ cohortId: input.projection.cohortId, rootDir: options.cohortArtifactsRoot });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport(input.projection.reportPreview), 'utf8');

    return {
      cohortId: input.projection.cohortId,
      reportPath: paths.reportJsonPath
    };
  }

  function materializeOne(cohortId: string): MaterializedCohort {
    const projected = projection.projectOne(cohortId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne
  };
}

export type CohortMaterializer = ReturnType<typeof createCohortMaterializer>;
