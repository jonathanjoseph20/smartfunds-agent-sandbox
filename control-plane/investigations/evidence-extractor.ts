import fs from 'node:fs';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { InvestigationEventRecord } from './investigation-types.ts';
import type { EvidenceRecord, EvidenceType } from './evidence-types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeFindingIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .sort((left, right) => left.localeCompare(right));
}

function evidenceId(input: {
  investigationRunId: string;
  phaseId: string;
  evidenceType: EvidenceType;
  sourceArtifactPath?: string;
  sourceDatasetKey?: string;
  summary: string;
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    investigationRunId: input.investigationRunId,
    phaseId: input.phaseId,
    evidenceType: input.evidenceType,
    sourceArtifactPath: input.sourceArtifactPath ?? null,
    sourceDatasetKey: input.sourceDatasetKey ?? null,
    summary: input.summary,
    payloadHash: sha256(canonicalStringify(input.payload))
  }));
}

function createEvidenceRecord(input: {
  investigationRunId: string;
  phaseId: string;
  evidenceType: EvidenceType;
  summary: string;
  payload: Record<string, unknown>;
  findingIds: string[];
  sourceArtifactPath?: string;
  sourceDatasetKey?: string;
}): EvidenceRecord {
  return {
    evidenceId: evidenceId({
      investigationRunId: input.investigationRunId,
      phaseId: input.phaseId,
      evidenceType: input.evidenceType,
      sourceArtifactPath: input.sourceArtifactPath,
      sourceDatasetKey: input.sourceDatasetKey,
      summary: input.summary,
      payload: input.payload
    }),
    investigationRunId: input.investigationRunId,
    phaseId: input.phaseId,
    evidenceType: input.evidenceType,
    ...(input.sourceArtifactPath ? { sourceArtifactPath: input.sourceArtifactPath } : {}),
    ...(input.sourceDatasetKey ? { sourceDatasetKey: input.sourceDatasetKey } : {}),
    summary: input.summary,
    payload: input.payload,
    findingIds: [...input.findingIds].sort((left, right) => left.localeCompare(right))
  };
}

function extractCounterOrGapEvidence(input: {
  investigationRunId: string;
  phaseId: string;
  sourceArtifactPath: string;
  artifact: Record<string, unknown>;
  findingIds: string[];
}): EvidenceRecord[] {
  const records: EvidenceRecord[] = [];

  const counterEvidence = Array.isArray(input.artifact.counterEvidence)
    ? input.artifact.counterEvidence.filter((entry): entry is string => typeof entry === 'string')
    : [];
  counterEvidence
    .sort((left, right) => left.localeCompare(right))
    .forEach((summary) => {
      records.push(createEvidenceRecord({
        investigationRunId: input.investigationRunId,
        phaseId: input.phaseId,
        evidenceType: 'counter_evidence',
        sourceArtifactPath: input.sourceArtifactPath,
        summary,
        payload: { summary },
        findingIds: input.findingIds
      }));
    });

  const unresolvedGaps = Array.isArray(input.artifact.unresolvedGaps)
    ? input.artifact.unresolvedGaps.filter((entry): entry is string => typeof entry === 'string')
    : [];
  unresolvedGaps
    .sort((left, right) => left.localeCompare(right))
    .forEach((summary) => {
      records.push(createEvidenceRecord({
        investigationRunId: input.investigationRunId,
        phaseId: input.phaseId,
        evidenceType: 'unresolved_gap',
        sourceArtifactPath: input.sourceArtifactPath,
        summary,
        payload: { summary },
        findingIds: input.findingIds
      }));
    });

  return records;
}

function readArtifact(filePath: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function extractArtifactEvidence(input: {
  investigationRunId: string;
  phaseId: string;
  sourceArtifactPath: string;
  findingIds: string[];
}): EvidenceRecord[] {
  const artifact = readArtifact(input.sourceArtifactPath);
  const dataset = typeof artifact.dataset === 'string' ? artifact.dataset : undefined;
  const records: EvidenceRecord[] = [];

  records.push(createEvidenceRecord({
    investigationRunId: input.investigationRunId,
    phaseId: input.phaseId,
    evidenceType: input.phaseId === 'gather' ? 'raw_observation' : 'contextual_support',
    sourceArtifactPath: input.sourceArtifactPath,
    ...(dataset ? { sourceDatasetKey: dataset } : {}),
    summary: `${input.phaseId} artifact captured`,
    payload: artifact,
    findingIds: input.findingIds
  }));

  if (isRecord(artifact.signalMetadata)) {
    const metadata = artifact.signalMetadata;
    const numericEntries = Object.entries(metadata)
      .filter(([, value]) => typeof value === 'number')
      .sort(([left], [right]) => left.localeCompare(right));

    for (const [key, value] of numericEntries) {
      records.push(createEvidenceRecord({
        investigationRunId: input.investigationRunId,
        phaseId: input.phaseId,
        evidenceType: 'derived_metric',
        sourceArtifactPath: input.sourceArtifactPath,
        ...(dataset ? { sourceDatasetKey: dataset } : {}),
        summary: `derived metric ${key}=${String(value)}`,
        payload: { key, value },
        findingIds: input.findingIds
      }));
    }
  }

  records.push(...extractCounterOrGapEvidence({
    investigationRunId: input.investigationRunId,
    phaseId: input.phaseId,
    sourceArtifactPath: input.sourceArtifactPath,
    artifact,
    findingIds: input.findingIds
  }));

  return records;
}

function crossCycleConfirmations(input: {
  investigationRunId: string;
  phaseId: string;
  history: InvestigationEventRecord[];
}): EvidenceRecord[] {
  const findingCounts = new Map<string, number>();

  input.history
    .filter((event): event is Extract<InvestigationEventRecord, { eventType: 'PHASE_COMPLETED' }> => event.eventType === 'PHASE_COMPLETED')
    .forEach((event) => {
      for (const finding of event.findings) {
        findingCounts.set(finding, (findingCounts.get(finding) ?? 0) + 1);
      }
    });

  return Array.from(findingCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([finding, count]) => createEvidenceRecord({
      investigationRunId: input.investigationRunId,
      phaseId: input.phaseId,
      evidenceType: 'cross_cycle_confirmation',
      summary: `finding confirmed across ${String(count)} completed phases`,
      payload: { finding, confirmations: count },
      findingIds: [finding]
    }));
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

export function extractEvidenceRecords(input: {
  investigationRunId: string;
  phaseId: string;
  artifactPaths: string[];
  findings: string[];
  history: InvestigationEventRecord[];
}): EvidenceRecord[] {
  const findings = normalizeFindingIds(input.findings);
  const artifacts = [...input.artifactPaths].sort((left, right) => left.localeCompare(right));
  const records: EvidenceRecord[] = [];

  for (const sourceArtifactPath of artifacts) {
    records.push(...extractArtifactEvidence({
      investigationRunId: input.investigationRunId,
      phaseId: input.phaseId,
      sourceArtifactPath,
      findingIds: findings
    }));
  }

  records.push(...crossCycleConfirmations({
    investigationRunId: input.investigationRunId,
    phaseId: input.phaseId,
    history: input.history
  }));

  return sortEvidence(records);
}
