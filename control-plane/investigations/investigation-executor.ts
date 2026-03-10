import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';
import { createSignalStore, type SignalStore } from '../signals/signal-store.ts';
import type { SignalRecord } from '../signals/signal-types.ts';

import { computeInvestigationDedupeKey, computeInvestigationRunId, createInvestigationDeduper, type InvestigationDeduper } from './investigation-deduper.ts';
import { createInvestigationRegistry, type InvestigationRegistry } from './investigation-registry.ts';
import { writeInvestigationReport } from './investigation-report.ts';
import { createInvestigationStore, type InvestigationStore } from './investigation-store.ts';
import {
  InvestigationError,
  type InvestigationDefinition,
  type InvestigationExecutionResult,
  type InvestigationLaunchRequest,
  type InvestigationPhaseDefinition,
} from './investigation-types.ts';

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeCanonicalJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${canonicalStringify(value)}\n`, 'utf8');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function sourceTriggerReference(input: InvestigationLaunchRequest, signal: SignalRecord): string {
  return `trigger:${input.triggerId}:${signal.dedupeKey}:${signal.slot}`;
}

function associatedMissionReferences(input: { launchRequest: InvestigationLaunchRequest; definition: InvestigationDefinition }): string[] {
  return uniqueSorted([
    input.launchRequest.missionId,
    ...input.definition.phases
      .map((phase) => phase.missionId)
      .filter((value): value is string => typeof value === 'string')
  ]);
}

function artifactPath(artifactsRoot: string, runId: string, fileName: string): string {
  return path.join(artifactsRoot, runId, fileName);
}

function phaseArtifactFileName(phase: InvestigationPhaseDefinition, suffix: string): string {
  return `${phase.phaseId}-${suffix}`;
}

function signalMetadata(signal: SignalRecord): Record<string, unknown> {
  return JSON.parse(canonicalStringify(signal.metadata)) as Record<string, unknown>;
}

function findingsForSignal(signal: SignalRecord): string[] {
  const metadata = signalMetadata(signal);
  const protocol = typeof metadata.protocol === 'string' ? metadata.protocol : 'unknown';

  if (signal.signalType === 'liquidity_drain') {
    return [`liquidity_drop:${protocol}:${String(metadata.liquidityDropPercent ?? 'unknown')}`];
  }
  if (signal.signalType === 'yield_anomaly') {
    return [`yield_change:${protocol}:${String(metadata.yieldChangePercent ?? 'unknown')}`];
  }
  if (signal.signalType === 'governance_proposal') {
    return [`governance_proposal:${protocol}:${String(metadata.proposalId ?? 'unknown')}`];
  }
  return [`protocol_risk:${protocol}:${String(metadata.riskLevel ?? 'unknown')}`];
}

function executePhase(input: {
  phase: InvestigationPhaseDefinition;
  definition: InvestigationDefinition;
  signal: SignalRecord;
  launchRequest: InvestigationLaunchRequest;
  runId: string;
  artifactsRoot: string;
}): { artifacts: string[]; findings: string[] } {
  const metadata = signalMetadata(input.signal);
  const baseFindings = findingsForSignal(input.signal);

  if (input.phase.kind === 'intake') {
    const filePath = artifactPath(input.artifactsRoot, input.runId, phaseArtifactFileName(input.phase, 'context.json'));
    writeCanonicalJson(filePath, {
      investigationDefinitionId: input.definition.investigationDefinitionId,
      sourceSignalReference: input.signal.dedupeKey,
      sourceSignalType: input.signal.signalType,
      sourceTriggerId: input.launchRequest.triggerId,
      slot: input.signal.slot
    });
    return {
      artifacts: [filePath],
      findings: [`intake_confirmed:${input.signal.signalType}`]
    };
  }

  if (input.phase.kind === 'gather') {
    const filePath = artifactPath(input.artifactsRoot, input.runId, phaseArtifactFileName(input.phase, 'evidence.json'));
    writeCanonicalJson(filePath, {
      dataset: input.signal.dataset,
      signalMetadata: metadata,
      ...(input.signal.artifactReference ? { sourceArtifactReference: input.signal.artifactReference } : {}),
      requiredInputs: input.phase.requiredInputs
    });
    return {
      artifacts: [filePath],
      findings: uniqueSorted(baseFindings)
    };
  }

  if (input.phase.kind === 'analyze') {
    const filePath = artifactPath(input.artifactsRoot, input.runId, phaseArtifactFileName(input.phase, 'assessment.json'));
    writeCanonicalJson(filePath, {
      investigationDefinitionId: input.definition.investigationDefinitionId,
      signalType: input.signal.signalType,
      protocol: metadata.protocol ?? 'unknown',
      slot: input.signal.slot,
      findings: uniqueSorted(baseFindings)
    });
    return {
      artifacts: [filePath],
      findings: uniqueSorted([...baseFindings, `analysis_ready:${input.signal.signalType}`])
    };
  }

  if (input.phase.kind === 'synthesize') {
    const filePath = artifactPath(input.artifactsRoot, input.runId, phaseArtifactFileName(input.phase, 'findings.json'));
    const findings = uniqueSorted([...baseFindings, `synthesized:${input.definition.investigationDefinitionId}`]);
    writeCanonicalJson(filePath, {
      findings,
      associatedMissionReferences: associatedMissionReferences({
        launchRequest: input.launchRequest,
        definition: input.definition
      })
    });
    return {
      artifacts: [filePath],
      findings
    };
  }

  return {
    artifacts: [],
    findings: uniqueSorted(baseFindings)
  };
}

export function createInvestigationExecutor(options: {
  definitionsDir?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  signalsRootDir?: string;
  registry?: InvestigationRegistry;
  store?: InvestigationStore;
  signalStore?: SignalStore;
  deduper?: InvestigationDeduper;
  phaseExecutor?: (input: {
    phase: InvestigationPhaseDefinition;
    definition: InvestigationDefinition;
    signal: SignalRecord;
    launchRequest: InvestigationLaunchRequest;
    runId: string;
    artifactsRoot: string;
  }) => { artifacts: string[]; findings: string[] };
} = {}) {
  const resolvedInvestigationsRoot = path.resolve(options.investigationsRootDir ?? 'investigations');
  const resolvedArtifactsRoot = path.resolve(options.investigationArtifactsRoot ?? path.join('artifacts', 'investigations'));
  const registry = options.registry ?? createInvestigationRegistry({ definitionsDir: options.definitionsDir });
  const store = options.store ?? createInvestigationStore({ rootDir: resolvedInvestigationsRoot });
  const signalStore = options.signalStore ?? createSignalStore({ rootDir: options.signalsRootDir });
  const deduper = options.deduper ?? createInvestigationDeduper(store);
  const phaseExecutor = options.phaseExecutor ?? executePhase;

  function resolveSignal(sourceSignal: string): SignalRecord {
    const signal = signalStore.getSignalByDedupeKey(sourceSignal);
    if (!signal) {
      throw new InvestigationError(
        'INVESTIGATION_SOURCE_SIGNAL_NOT_FOUND',
        `Signal not found for investigation launch: ${sourceSignal}`
      );
    }
    return signal;
  }

  function recordArtifact(logDate: string, investigationRunId: string, artifactPathValue: string, artifactKind: string): void {
    store.appendEvent({
      logDate,
      event: {
        eventType: 'ARTIFACT_RECORDED',
        investigationRunId,
        artifactPath: artifactPathValue,
        artifactKind
      }
    });
  }

  function executeLaunchRequest(launchRequest: InvestigationLaunchRequest): InvestigationExecutionResult {
    const signal = resolveSignal(launchRequest.sourceSignal);
    const definition = registry.resolveInvestigation({
      triggerId: launchRequest.triggerId,
      signalType: signal.signalType
    });
    const dedupeKey = computeInvestigationDedupeKey({
      investigationDefinitionId: definition.investigationDefinitionId,
      sourceSignalReference: signal.dedupeKey,
      slot: signal.slot
    });

    if (deduper.isDuplicateInvestigation(dedupeKey)) {
      const existing = store.listInvestigations().find((record) => record.dedupeKey === dedupeKey);
      if (!existing) {
        throw new InvestigationError('INVESTIGATION_DUPLICATE_MISSING_RECORD', `Duplicate investigation missing record for ${dedupeKey}`);
      }
      return {
        status: 'duplicate',
        record: existing
      };
    }

    const investigationRunId = computeInvestigationRunId(dedupeKey);
    const missions = associatedMissionReferences({ launchRequest, definition });

    store.appendEvent({
      logDate: signal.logDate,
      event: {
        eventType: 'INVESTIGATION_CREATED',
        investigationRunId,
        dedupeKey,
        investigationDefinitionId: definition.investigationDefinitionId,
        sourceSignalReference: signal.dedupeKey,
        sourceSignalType: signal.signalType,
        sourceTriggerId: launchRequest.triggerId,
        sourceTriggerReference: sourceTriggerReference(launchRequest, signal),
        slot: signal.slot,
        associatedMissionReferences: missions
      }
    });

    try {
      for (const phase of definition.phases) {
        store.appendEvent({
          logDate: signal.logDate,
          event: {
            eventType: 'PHASE_STARTED',
            investigationRunId,
            phaseId: phase.phaseId,
            phaseKind: phase.kind
          }
        });

        const phaseResult = phaseExecutor({
          phase,
          definition,
          signal,
          launchRequest,
          runId: investigationRunId,
          artifactsRoot: resolvedArtifactsRoot
        });

        phaseResult.artifacts
          .sort((left, right) => left.localeCompare(right))
          .forEach((artifact) => {
            recordArtifact(signal.logDate, investigationRunId, artifact, phase.kind);
          });

        store.appendEvent({
          logDate: signal.logDate,
          event: {
            eventType: 'PHASE_COMPLETED',
            investigationRunId,
            phaseId: phase.phaseId,
            phaseKind: phase.kind,
            findings: uniqueSorted(phaseResult.findings)
          }
        });
      }

      const completedRecordBeforeReport = store.getInvestigation(investigationRunId);
      const reportArtifacts = writeInvestigationReport({
        artifactsRoot: resolvedArtifactsRoot,
        record: completedRecordBeforeReport,
        definition,
        history: store.getInvestigationHistory(investigationRunId)
      });

      [reportArtifacts.jsonPath, reportArtifacts.markdownPath]
        .sort((left, right) => left.localeCompare(right))
        .forEach((artifact) => {
          recordArtifact(signal.logDate, investigationRunId, artifact, 'finalize');
        });

      store.appendEvent({
        logDate: signal.logDate,
        event: {
          eventType: 'INVESTIGATION_COMPLETED',
          investigationRunId,
          finalReportPath: reportArtifacts.markdownPath,
          findings: uniqueSorted(completedRecordBeforeReport.findings)
        }
      });

      return {
        status: 'started',
        record: store.getInvestigation(investigationRunId)
      };
    } catch (error) {
      const currentRecord = store.getInvestigation(investigationRunId);
      store.appendEvent({
        logDate: signal.logDate,
        event: {
          eventType: 'INVESTIGATION_FAILED',
          investigationRunId,
          phaseId: currentRecord.currentPhaseId ?? definition.phases[0].phaseId,
          reason: error instanceof Error ? error.message : 'investigation_execution_failed'
        }
      });

      return {
        status: 'failed',
        record: store.getInvestigation(investigationRunId)
      };
    }
  }

  function executeLaunchRequests(launchRequests: InvestigationLaunchRequest[]): InvestigationExecutionResult[] {
    return [...launchRequests]
      .sort((left, right) => {
        const triggerCmp = left.triggerId.localeCompare(right.triggerId);
        if (triggerCmp !== 0) {
          return triggerCmp;
        }
        const signalCmp = left.sourceSignal.localeCompare(right.sourceSignal);
        if (signalCmp !== 0) {
          return signalCmp;
        }
        return left.missionId.localeCompare(right.missionId);
      })
      .map((launchRequest) => executeLaunchRequest(launchRequest));
  }

  return {
    executeLaunchRequest,
    executeLaunchRequests,
    listInvestigations: store.listInvestigations,
    getInvestigation: store.getInvestigation,
    investigationsRootDir: resolvedInvestigationsRoot,
    investigationArtifactsRoot: resolvedArtifactsRoot
  };
}

export type InvestigationExecutor = ReturnType<typeof createInvestigationExecutor>;
