import fs from 'node:fs';
import path from 'node:path';

import { createEvidenceStore, type EvidenceStore } from './evidence-store.ts';
import { buildInvestigationConfidenceProjection } from './findings.ts';
import { computeConfidenceTrend } from './confidence-trend.ts';
import { createInvestigationRegistry, type InvestigationRegistry } from './investigation-registry.ts';
import { createInvestigationRevisionStore, type InvestigationRevisionStore } from './investigation-revision-store.ts';
import { createInvestigationStore, type InvestigationStore } from './investigation-store.ts';
import type { InvestigationCompletionStatus } from './completion-types.ts';

function defaultCompletionStatus(investigationRunId: string): InvestigationCompletionStatus {
  return {
    investigationRunId,
    readinessState: 'inconclusive',
    convergenceState: 'inconclusive',
    healthState: 'inconclusive',
    blockingReasons: [],
    strengths: [],
    limitations: []
  };
}

export function createInvestigationInspection(options: {
  definitionsDir?: string;
  rootDir?: string;
  artifactsRoot?: string;
  registry?: InvestigationRegistry;
  store?: InvestigationStore;
  evidenceStore?: EvidenceStore;
  revisionStore?: InvestigationRevisionStore;
} = {}) {
  const registry = options.registry ?? createInvestigationRegistry({ definitionsDir: options.definitionsDir });
  const store = options.store ?? createInvestigationStore({ rootDir: options.rootDir });
  const evidenceStore = options.evidenceStore ?? createEvidenceStore({
    artifactsRoot: options.artifactsRoot ?? path.join('artifacts', 'investigations')
  });
  const revisionStore = options.revisionStore ?? createInvestigationRevisionStore({
    artifactsRoot: options.artifactsRoot ?? path.join('artifacts', 'investigations')
  });

  function listInvestigations(input: {
    status?: string;
    triggerId?: string;
    signalType?: string;
  } = {}) {
    return store.listInvestigations({
      ...(input.status ? { status: input.status as Parameters<typeof store.listInvestigations>[0]['status'] } : {}),
      ...(input.triggerId ? { sourceTriggerId: input.triggerId } : {}),
      ...(input.signalType ? { sourceSignalType: input.signalType } : {})
    });
  }

  function inspectInvestigation(investigationRunId: string) {
    const record = store.getInvestigation(investigationRunId);
    const history = store.getInvestigationHistory(investigationRunId);

    return {
      record,
      definition: registry.getInvestigation(record.investigationDefinitionId),
      history
    };
  }

  function historyByDate() {
    return store.listHistory();
  }

  function listEvidence(investigationRunId: string) {
    store.getInvestigation(investigationRunId);
    return evidenceStore.loadEvidence(investigationRunId);
  }

  function inspectFindings(investigationRunId: string) {
    const record = store.getInvestigation(investigationRunId);
    const definition = registry.getInvestigation(record.investigationDefinitionId);
    return buildInvestigationConfidenceProjection({
      investigationRunId,
      definition,
      findings: record.findings,
      evidence: evidenceStore.loadEvidence(investigationRunId)
    }).findings;
  }

  function inspectConfidence(investigationRunId: string) {
    const record = store.getInvestigation(investigationRunId);
    const definition = registry.getInvestigation(record.investigationDefinitionId);
    const projection = buildInvestigationConfidenceProjection({
      investigationRunId,
      definition,
      findings: record.findings,
      evidence: evidenceStore.loadEvidence(investigationRunId)
    });
    return {
      investigationRunId,
      reportConfidence: projection.reportConfidence,
      confidenceByPhase: projection.confidenceByPhase
    };
  }

  function readReport(investigationRunId: string): { reportPath: string; content: string } {
    const record = store.getInvestigation(investigationRunId);
    if (!record.finalReportPath) {
      throw new Error(`INVESTIGATION_REPORT_NOT_FOUND: ${investigationRunId}`);
    }
    if (!fs.existsSync(record.finalReportPath)) {
      throw new Error(`INVESTIGATION_REPORT_NOT_FOUND: ${record.finalReportPath}`);
    }

    return {
      reportPath: record.finalReportPath,
      content: fs.readFileSync(record.finalReportPath, 'utf8')
    };
  }

  function listRevisions(investigationRunId: string) {
    store.getInvestigation(investigationRunId);
    return revisionStore.listRevisions(investigationRunId);
  }

  function inspectLatestDelta(investigationRunId: string) {
    const revisions = listRevisions(investigationRunId);
    if (revisions.length === 0) {
      return {
        investigationRunId,
        revisionCount: 0,
        delta: null
      };
    }
    const latest = revisions[revisions.length - 1];
    return {
      investigationRunId,
      revisionCount: revisions.length,
      revisionId: latest.revisionId,
      delta: revisionStore.loadDelta(latest)
    };
  }

  function inspectTrend(investigationRunId: string) {
    const revisions = listRevisions(investigationRunId);
    if (revisions.length === 0) {
      return {
        investigationRunId,
        revisionCount: 0,
        confidenceTrend: 'flat'
      };
    }
    const confidenceSnapshots = revisions.map((revision) => revisionStore.loadConfidenceSnapshot(revision));
    return {
      investigationRunId,
      revisionCount: revisions.length,
      confidenceTrend: computeConfidenceTrend(confidenceSnapshots)
    };
  }

  function inspectContinuitySummary(investigationRunId: string) {
    const revisions = listRevisions(investigationRunId);
    if (revisions.length === 0) {
      const completion = defaultCompletionStatus(investigationRunId);
      return {
        investigationRunId,
        revisionCount: 0,
        continuityState: 'inconclusive',
        confidenceTrend: 'flat',
        majorChanges: [],
        unresolvedLimitations: [],
        readinessState: completion.readinessState,
        convergenceState: completion.convergenceState,
        healthState: completion.healthState,
        blockingReasons: completion.blockingReasons
      };
    }
    const latest = revisions[revisions.length - 1];
    const summary = revisionStore.loadContinuitySummary(latest);
    const completion = revisionStore.loadCompletionStatus(latest) ?? defaultCompletionStatus(investigationRunId);
    if (!summary) {
      return {
        investigationRunId,
        revisionCount: revisions.length,
        continuityState: 'inconclusive',
        confidenceTrend: inspectTrend(investigationRunId).confidenceTrend,
        majorChanges: [],
        unresolvedLimitations: [],
        readinessState: completion.readinessState,
        convergenceState: completion.convergenceState,
        healthState: completion.healthState,
        blockingReasons: completion.blockingReasons
      };
    }
    return {
      ...summary,
      readinessState: completion.readinessState,
      convergenceState: completion.convergenceState,
      healthState: completion.healthState,
      blockingReasons: completion.blockingReasons
    };
  }

  function inspectCompletionStatus(investigationRunId: string): InvestigationCompletionStatus {
    const revisions = listRevisions(investigationRunId);
    if (revisions.length === 0) {
      return defaultCompletionStatus(investigationRunId);
    }
    const latest = revisions[revisions.length - 1];
    return revisionStore.loadCompletionStatus(latest) ?? defaultCompletionStatus(investigationRunId);
  }

  function inspectConvergenceState(investigationRunId: string) {
    const status = inspectCompletionStatus(investigationRunId);
    return {
      investigationRunId,
      convergenceState: status.convergenceState
    };
  }

  function inspectHealthState(investigationRunId: string) {
    const status = inspectCompletionStatus(investigationRunId);
    return {
      investigationRunId,
      healthState: status.healthState
    };
  }

  return {
    listDefinitions: registry.listInvestigations,
    listInvestigations,
    inspectInvestigation,
    historyByDate,
    readReport,
    listEvidence,
    inspectFindings,
    inspectConfidence,
    listRevisions,
    inspectLatestDelta,
    inspectTrend,
    inspectContinuitySummary,
    inspectCompletionStatus,
    inspectConvergenceState,
    inspectHealthState
  };
}

export type InvestigationInspection = ReturnType<typeof createInvestigationInspection>;
