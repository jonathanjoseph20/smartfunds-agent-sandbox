import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import type { EvidenceRecord } from './evidence-types.ts';

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortEvidence(records: EvidenceRecord[]): EvidenceRecord[] {
  return [...records].sort((left, right) => {
    const typeCmp = left.evidenceType.localeCompare(right.evidenceType);
    if (typeCmp !== 0) {
      return typeCmp;
    }
    const phaseCmp = left.phaseId.localeCompare(right.phaseId);
    if (phaseCmp !== 0) {
      return phaseCmp;
    }
    return left.evidenceId.localeCompare(right.evidenceId);
  });
}

function normalizeEvidenceRecord(value: unknown): EvidenceRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.evidenceId !== 'string'
    || typeof value.investigationRunId !== 'string'
    || typeof value.phaseId !== 'string'
    || typeof value.evidenceType !== 'string'
    || typeof value.summary !== 'string'
  ) {
    return null;
  }

  const payload = isRecord(value.payload) ? value.payload : {};
  return {
    evidenceId: value.evidenceId,
    investigationRunId: value.investigationRunId,
    phaseId: value.phaseId,
    evidenceType: value.evidenceType as EvidenceRecord['evidenceType'],
    ...(typeof value.sourceArtifactPath === 'string' ? { sourceArtifactPath: value.sourceArtifactPath } : {}),
    ...(typeof value.sourceDatasetKey === 'string' ? { sourceDatasetKey: value.sourceDatasetKey } : {}),
    summary: value.summary,
    payload,
    findingIds: normalizeStringArray(value.findingIds)
  };
}

export function createEvidenceStore(options: {
  artifactsRoot?: string;
} = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? path.join('artifacts', 'investigations'));

  function evidencePath(investigationRunId: string): string {
    return path.join(artifactsRoot, investigationRunId, 'evidence', 'evidence.json');
  }

  function loadEvidence(investigationRunId: string): EvidenceRecord[] {
    const filePath = evidencePath(investigationRunId);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortEvidence(parsed
      .map((entry) => normalizeEvidenceRecord(entry))
      .filter((entry): entry is EvidenceRecord => entry !== null));
  }

  function persistEvidence(investigationRunId: string, records: EvidenceRecord[]): EvidenceRecord[] {
    const filePath = evidencePath(investigationRunId);
    ensureDir(path.dirname(filePath));
    const ordered = sortEvidence(records);
    fs.writeFileSync(filePath, `${canonicalStringify(ordered)}\n`, 'utf8');
    return ordered;
  }

  function mergeEvidence(investigationRunId: string, records: EvidenceRecord[]): EvidenceRecord[] {
    const existing = loadEvidence(investigationRunId);
    const byId = new Map<string, EvidenceRecord>();

    for (const record of existing) {
      byId.set(record.evidenceId, record);
    }

    for (const record of records) {
      const current = byId.get(record.evidenceId);
      if (!current) {
        byId.set(record.evidenceId, record);
        continue;
      }

      byId.set(record.evidenceId, {
        ...current,
        ...record,
        findingIds: Array.from(new Set([...current.findingIds, ...record.findingIds]))
          .sort((left, right) => left.localeCompare(right))
      });
    }

    return persistEvidence(investigationRunId, Array.from(byId.values()));
  }

  return {
    evidencePath,
    loadEvidence,
    mergeEvidence,
    persistEvidence
  };
}

export type EvidenceStore = ReturnType<typeof createEvidenceStore>;
