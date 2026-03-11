import fs from 'node:fs';

import { canonicalStringify } from '../../finance/determinism.ts';

import { createCohortProgramInspection, type CohortProgramInspection } from './program-inspection.ts';
import { toProgramReportMarkdown } from './program-report.ts';
import { ensureCohortProgramArtifactDir, resolveCohortProgramArtifactPaths } from './program-runtime-paths.ts';

export type MaterializedProgram = {
  cohortId: string;
  programId: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportMarkdownPath: string;
};

export function createCohortProgramMaterializer(options: {
  inspection?: CohortProgramInspection;
  cohortArtifactsRoot?: string;
  cohortProgramDefinitionsDir?: string;
  cohortDefinitionsDir?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
} = {}) {
  const inspection = options.inspection ?? createCohortProgramInspection({
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });

  function materializeCohortPrograms(input: { cohortId: string; slot?: string }): MaterializedProgram[] {
    const status = inspection.inspectProgramStatus({
      cohortId: input.cohortId,
      ...(input.slot ? { slot: input.slot } : {})
    });
    const history = inspection.inspectProgramHistory({ cohortId: input.cohortId });

    return status.programs
      .map((programStatus) => {
        const paths = resolveCohortProgramArtifactPaths({
          cohortId: input.cohortId,
          programId: programStatus.programId,
          rootDir: options.cohortArtifactsRoot
        });
        ensureCohortProgramArtifactDir({
          cohortId: input.cohortId,
          programId: programStatus.programId,
          rootDir: options.cohortArtifactsRoot
        });

        const programHistory = history.find((entry) => entry.programId === programStatus.programId) ?? {
          cohortId: input.cohortId,
          programId: programStatus.programId,
          entries: []
        };

        fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify({
          cohortId: input.cohortId,
          cohortLifecycleState: status.cohortLifecycleState,
          program: programStatus
        })}\n`, 'utf8');
        fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(programHistory)}\n`, 'utf8');
        fs.writeFileSync(paths.reportMarkdownPath, toProgramReportMarkdown({
          status: {
            cohortId: input.cohortId,
            cohortLifecycleState: status.cohortLifecycleState,
            programs: [programStatus]
          },
          history: [programHistory]
        }), 'utf8');

        return {
          cohortId: input.cohortId,
          programId: programStatus.programId,
          statusJsonPath: paths.statusJsonPath,
          historyJsonPath: paths.historyJsonPath,
          reportMarkdownPath: paths.reportMarkdownPath
        };
      })
      .sort((left, right) => left.programId.localeCompare(right.programId));
  }

  return {
    materializeCohortPrograms
  };
}

export type CohortProgramMaterializer = ReturnType<typeof createCohortProgramMaterializer>;
