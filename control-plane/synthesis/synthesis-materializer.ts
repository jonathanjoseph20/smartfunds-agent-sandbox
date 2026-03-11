import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import type { SynthesisProjection, SynthesisProjectionEngine } from './synthesis-projection.ts';
import { createSynthesisProjection } from './synthesis-projection.ts';
import { ensureSynthesisArtifactDir, resolveSynthesisArtifactPaths } from './synthesis-runtime-paths.ts';

export interface MaterializedSynthesis {
  synthesisId: string;
  reportPath: string;
  materializedAtSlot?: string;
}

function toMarkdownPreview(reportPreview: Record<string, unknown>): string {
  const lines = [
    '# Cross-Investigation Synthesis Report',
    '',
    `${canonicalStringify(reportPreview)}`
  ];
  return `${lines.join('\n')}\n`;
}

export function createSynthesisMaterializer(options: {
  projection?: SynthesisProjectionEngine;
  synthesisArtifactsRoot?: string;
  synthesisDefinitionsDir?: string;
  investigationDefinitionsDir?: string;
  investigationsRootDir?: string;
  signalsRootDir?: string;
  investigationArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createSynthesisProjection({
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });

  function materializeProjection(input: { projection: SynthesisProjection; materializedAtSlot?: string }): MaterializedSynthesis {
    ensureSynthesisArtifactDir({ synthesisId: input.projection.synthesisId, rootDir: options.synthesisArtifactsRoot });
    const paths = resolveSynthesisArtifactPaths({ synthesisId: input.projection.synthesisId, rootDir: options.synthesisArtifactsRoot });

    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(input.projection.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownPreview(input.projection.reportPreview), 'utf8');
    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection.status)}\n`, 'utf8');
    fs.writeFileSync(paths.conflictsJsonPath, `${canonicalStringify(input.projection.conflicts)}\n`, 'utf8');

    return {
      synthesisId: input.projection.synthesisId,
      reportPath: paths.reportJsonPath,
      ...(input.materializedAtSlot ? { materializedAtSlot: input.materializedAtSlot } : {})
    };
  }

  function materializeOne(synthesisId: string): MaterializedSynthesis {
    const projected = projection.projectOne(synthesisId);
    return materializeProjection({ projection: projected });
  }

  return {
    materializeProjection,
    materializeOne
  };
}

export type SynthesisMaterializer = ReturnType<typeof createSynthesisMaterializer>;
