import fs from 'node:fs';
import path from 'node:path';

import { createEvidenceStore, type EvidenceStore } from './evidence-store.ts';
import { buildInvestigationConfidenceProjection } from './findings.ts';
import { createInvestigationRegistry, type InvestigationRegistry } from './investigation-registry.ts';
import { createInvestigationStore, type InvestigationStore } from './investigation-store.ts';

export function createInvestigationInspection(options: {
  definitionsDir?: string;
  rootDir?: string;
  artifactsRoot?: string;
  registry?: InvestigationRegistry;
  store?: InvestigationStore;
  evidenceStore?: EvidenceStore;
} = {}) {
  const registry = options.registry ?? createInvestigationRegistry({ definitionsDir: options.definitionsDir });
  const store = options.store ?? createInvestigationStore({ rootDir: options.rootDir });
  const evidenceStore = options.evidenceStore ?? createEvidenceStore({
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

  return {
    listDefinitions: registry.listInvestigations,
    listInvestigations,
    inspectInvestigation,
    historyByDate,
    readReport,
    listEvidence,
    inspectFindings,
    inspectConfidence
  };
}

export type InvestigationInspection = ReturnType<typeof createInvestigationInspection>;
