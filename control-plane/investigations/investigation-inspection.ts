import fs from 'node:fs';

import { createInvestigationRegistry, type InvestigationRegistry } from './investigation-registry.ts';
import { createInvestigationStore, type InvestigationStore } from './investigation-store.ts';

export function createInvestigationInspection(options: {
  definitionsDir?: string;
  rootDir?: string;
  registry?: InvestigationRegistry;
  store?: InvestigationStore;
} = {}) {
  const registry = options.registry ?? createInvestigationRegistry({ definitionsDir: options.definitionsDir });
  const store = options.store ?? createInvestigationStore({ rootDir: options.rootDir });

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
    readReport
  };
}

export type InvestigationInspection = ReturnType<typeof createInvestigationInspection>;
