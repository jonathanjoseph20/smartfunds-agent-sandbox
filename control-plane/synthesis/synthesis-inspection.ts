import fs from 'node:fs';

import { createSynthesisEngine, type SynthesisEngine } from './synthesis-engine.ts';
import { createSynthesisStore, type SynthesisStore } from './synthesis-store.ts';
import { SynthesisError, type SynthesisReport } from './synthesis-types.ts';

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right);
}

export function createSynthesisInspection(options: {
  engine?: SynthesisEngine;
  store?: SynthesisStore;
  synthesisRootDir?: string;
  synthesisArtifactsRoot?: string;
  synthesisDefinitionsDir?: string;
  investigationDefinitionsDir?: string;
  investigationsRootDir?: string;
  signalsRootDir?: string;
  investigationArtifactsRoot?: string;
} = {}) {
  const engine = options.engine ?? createSynthesisEngine({
    synthesisRootDir: options.synthesisRootDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot
  });
  const store = options.store ?? createSynthesisStore({ rootDir: options.synthesisRootDir });

  function materialize(): SynthesisReport[] {
    return engine.runAll();
  }

  function latestJsonReportPath(synthesisId: string): string {
    const record = store.getSynthesisSet(synthesisId);
    const path = [...record.latestArtifactPaths]
      .sort(comparePath)
      .find((entry) => entry.endsWith('synthesis-report.json'));

    if (!path || !fs.existsSync(path)) {
      const refreshed = engine.runOne(synthesisId);
      const fallback = [...refreshed.artifactPaths]
        .sort(comparePath)
        .find((entry) => entry.endsWith('synthesis-report.json'));
      if (!fallback || !fs.existsSync(fallback)) {
        throw new SynthesisError('SYNTHESIS_REPORT_NOT_FOUND', `Synthesis JSON report not found: ${synthesisId}`);
      }
      return fallback;
    }

    return path;
  }

  function latestMarkdownReportPath(synthesisId: string): string {
    const record = store.getSynthesisSet(synthesisId);
    const path = [...record.latestArtifactPaths]
      .sort(comparePath)
      .find((entry) => entry.endsWith('synthesis-report.md'));

    if (!path || !fs.existsSync(path)) {
      const refreshed = engine.runOne(synthesisId);
      const fallback = [...refreshed.artifactPaths]
        .sort(comparePath)
        .find((entry) => entry.endsWith('synthesis-report.md'));
      if (!fallback || !fs.existsSync(fallback)) {
        throw new SynthesisError('SYNTHESIS_REPORT_NOT_FOUND', `Synthesis markdown report not found: ${synthesisId}`);
      }
      return fallback;
    }

    return path;
  }

  function listSynthesisSets(input: { synthesisType?: string; status?: string } = {}) {
    materialize();

    return store
      .listSynthesisSets({
        ...(input.synthesisType ? { synthesisType: input.synthesisType } : {}),
        ...(input.status ? { status: input.status as Parameters<typeof store.listSynthesisSets>[0]['status'] } : {})
      })
      .map((record) => ({
        synthesisId: record.synthesisId,
        synthesisType: record.synthesisType,
        subjectKey: record.subjectKey,
        status: record.status,
        linkedInvestigationCount: record.linkedInvestigationIds.length,
        ...(record.latestConfidenceBand ? { confidenceBand: record.latestConfidenceBand } : {}),
        artifactPaths: [...record.latestArtifactPaths].sort(comparePath)
      }));
  }

  function inspectSynthesis(synthesisId: string): SynthesisReport {
    materialize();
    return readJson<SynthesisReport>(latestJsonReportPath(synthesisId));
  }

  function inspectLinks(synthesisId: string) {
    const report = inspectSynthesis(synthesisId);
    return {
      synthesisId: report.synthesisId,
      synthesisType: report.synthesisType,
      subjectKey: report.subjectKey,
      linkedInvestigationIds: report.linkedInvestigations
        .map((entry) => entry.investigationRunId)
        .sort((left, right) => left.localeCompare(right)),
      linkedReasons: [...report.linkedReasons].sort((left, right) => {
        const d = left.dimension.localeCompare(right.dimension);
        if (d !== 0) {
          return d;
        }
        const v = left.value.localeCompare(right.value);
        if (v !== 0) {
          return v;
        }
        return left.reason.localeCompare(right.reason);
      })
    };
  }

  function inspectConfidence(synthesisId: string) {
    const report = inspectSynthesis(synthesisId);
    return {
      synthesisId: report.synthesisId,
      confidence: report.confidence
    };
  }

  function readReport(synthesisId: string): { reportPath: string; content: string } {
    materialize();
    const markdownPath = latestMarkdownReportPath(synthesisId);
    return {
      reportPath: markdownPath,
      content: fs.readFileSync(markdownPath, 'utf8')
    };
  }

  return {
    materialize,
    listSynthesisSets,
    inspectSynthesis,
    inspectLinks,
    inspectConfidence,
    readReport
  };
}

export type SynthesisInspection = ReturnType<typeof createSynthesisInspection>;
