import fs from 'node:fs';
import path from 'node:path';

import type { InvestigationCompletionStatus } from './completion-types.ts';
import type {
  ConfidenceSnapshot,
  FindingSnapshot,
  InvestigationContinuitySummary,
  InvestigationDelta,
  InvestigationRevisionRecord,
} from './revision-types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function compareRevision(left: InvestigationRevisionRecord, right: InvestigationRevisionRecord): number {
  return left.revisionNumber - right.revisionNumber;
}

function normalizeRevisionRecord(value: unknown): InvestigationRevisionRecord {
  if (!isRecord(value)) {
    throw new Error('INVESTIGATION_REVISION_INVALID_RECORD');
  }

  if (
    typeof value.revisionId !== 'string'
    || typeof value.investigationRunId !== 'string'
    || !Number.isInteger(value.revisionNumber)
    || typeof value.reportPath !== 'string'
    || typeof value.findingsSnapshotPath !== 'string'
    || typeof value.confidenceSnapshotPath !== 'string'
  ) {
    throw new Error('INVESTIGATION_REVISION_INVALID_RECORD');
  }

  return {
    revisionId: value.revisionId,
    investigationRunId: value.investigationRunId,
    revisionNumber: Number(value.revisionNumber),
    ...(typeof value.slotReference === 'string' ? { slotReference: value.slotReference } : {}),
    reportPath: value.reportPath,
    findingsSnapshotPath: value.findingsSnapshotPath,
    confidenceSnapshotPath: value.confidenceSnapshotPath,
    ...(typeof value.deltaPath === 'string' ? { deltaPath: value.deltaPath } : {}),
    ...(typeof value.continuitySummaryPath === 'string' ? { continuitySummaryPath: value.continuitySummaryPath } : {}),
    ...(typeof value.completionStatusPath === 'string' ? { completionStatusPath: value.completionStatusPath } : {})
  };
}

export function createInvestigationRevisionStore(options: {
  artifactsRoot?: string;
} = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? path.join('artifacts', 'investigations'));

  function revisionsRoot(investigationRunId: string): string {
    return path.join(artifactsRoot, investigationRunId, 'revisions');
  }

  function revisionDir(investigationRunId: string, revisionId: string): string {
    return path.join(revisionsRoot(investigationRunId), revisionId);
  }

  function listRevisionIds(investigationRunId: string): string[] {
    const root = revisionsRoot(investigationRunId);
    if (!fs.existsSync(root)) {
      return [];
    }
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => /^revision-\d{4}$/.test(name))
      .sort((left, right) => left.localeCompare(right));
  }

  function loadRevision(investigationRunId: string, revisionId: string): InvestigationRevisionRecord {
    return normalizeRevisionRecord(parseJson(path.join(revisionDir(investigationRunId, revisionId), 'revision-summary.json')));
  }

  function listRevisions(investigationRunId: string): InvestigationRevisionRecord[] {
    return listRevisionIds(investigationRunId)
      .map((revisionId) => loadRevision(investigationRunId, revisionId))
      .sort(compareRevision);
  }

  function loadFindingsSnapshot(revision: InvestigationRevisionRecord): FindingSnapshot[] {
    if (!fs.existsSync(revision.findingsSnapshotPath)) {
      return [];
    }
    const parsed = parseJson<unknown>(revision.findingsSnapshotPath);
    return Array.isArray(parsed) ? parsed as FindingSnapshot[] : [];
  }

  function loadConfidenceSnapshot(revision: InvestigationRevisionRecord): ConfidenceSnapshot {
    return parseJson<ConfidenceSnapshot>(revision.confidenceSnapshotPath);
  }

  function loadDelta(revision: InvestigationRevisionRecord): InvestigationDelta | null {
    if (!revision.deltaPath || !fs.existsSync(revision.deltaPath)) {
      return null;
    }
    return parseJson<InvestigationDelta>(revision.deltaPath);
  }

  function loadContinuitySummary(revision: InvestigationRevisionRecord): InvestigationContinuitySummary | null {
    if (!revision.continuitySummaryPath || !fs.existsSync(revision.continuitySummaryPath)) {
      return null;
    }
    return parseJson<InvestigationContinuitySummary>(revision.continuitySummaryPath);
  }

  function loadCompletionStatus(revision: InvestigationRevisionRecord): InvestigationCompletionStatus | null {
    if (!revision.completionStatusPath || !fs.existsSync(revision.completionStatusPath)) {
      return null;
    }
    return parseJson<InvestigationCompletionStatus>(revision.completionStatusPath);
  }

  function orderedRevisionHistory(investigationRunId: string): InvestigationRevisionRecord[] {
    return listRevisions(investigationRunId);
  }

  return {
    listRevisions,
    loadRevision,
    loadFindingsSnapshot,
    loadConfidenceSnapshot,
    loadDelta,
    loadContinuitySummary,
    loadCompletionStatus,
    orderedRevisionHistory
  };
}

export type InvestigationRevisionStore = ReturnType<typeof createInvestigationRevisionStore>;
