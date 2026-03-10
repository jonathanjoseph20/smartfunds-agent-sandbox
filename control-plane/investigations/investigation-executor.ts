import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';
import { createSignalStore, type SignalStore } from '../signals/signal-store.ts';
import type { SignalRecord } from '../signals/signal-types.ts';

import { computeInvestigationDedupeKey, computeInvestigationRunId, createInvestigationDeduper, type InvestigationDeduper } from './investigation-deduper.ts';
import {
  assertLegalTransition,
  classifyPhaseFailure,
  computeNextEligibleSlot,
  deriveLogDateFromSlot,
  evaluateDue,
  maxRetriesForPhase,
  resolveNextPhase,
  type InvestigationDueDecision,
} from './investigation-lifecycle.ts';
import { createInvestigationRegistry, type InvestigationRegistry } from './investigation-registry.ts';
import { writeInvestigationReport } from './investigation-report.ts';
import { createInvestigationStore, type InvestigationStore } from './investigation-store.ts';
import {
  InvestigationAwaitingDataError,
  InvestigationError,
  type InvestigationDefinition,
  type InvestigationDueItem,
  type InvestigationExecutionResult,
  type InvestigationLaunchRequest,
  type InvestigationPhaseDefinition,
  type InvestigationRecord,
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

type PhaseExecutionResult = {
  artifacts: string[];
  findings: string[];
  outcome?: 'completed' | 'scheduled_resume' | 'awaiting_data';
  reason?: string;
  nextEligibleSlot?: string;
};

function executePhase(input: {
  phase: InvestigationPhaseDefinition;
  definition: InvestigationDefinition;
  signal: SignalRecord;
  launchRequest: InvestigationLaunchRequest;
  runId: string;
  artifactsRoot: string;
}): PhaseExecutionResult {
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

function todayUtcIsoDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function compareDueItem(left: InvestigationDueItem, right: InvestigationDueItem): number {
  const dueCmp = Number(right.dueNow) - Number(left.dueNow);
  if (dueCmp !== 0) {
    return dueCmp;
  }
  const eligibleCmp = (left.nextEligibleSlot ?? '').localeCompare(right.nextEligibleSlot ?? '');
  if (eligibleCmp !== 0) {
    return eligibleCmp;
  }
  return left.investigationRunId.localeCompare(right.investigationRunId);
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
  now?: () => Date;
  phaseExecutor?: (input: {
    phase: InvestigationPhaseDefinition;
    definition: InvestigationDefinition;
    signal: SignalRecord;
    launchRequest: InvestigationLaunchRequest;
    runId: string;
    artifactsRoot: string;
  }) => PhaseExecutionResult;
} = {}) {
  const resolvedInvestigationsRoot = path.resolve(options.investigationsRootDir ?? 'investigations');
  const resolvedArtifactsRoot = path.resolve(options.investigationArtifactsRoot ?? path.join('artifacts', 'investigations'));
  const registry = options.registry ?? createInvestigationRegistry({ definitionsDir: options.definitionsDir });
  const store = options.store ?? createInvestigationStore({ rootDir: resolvedInvestigationsRoot });
  const signalStore = options.signalStore ?? createSignalStore({ rootDir: options.signalsRootDir });
  const deduper = options.deduper ?? createInvestigationDeduper(store);
  const phaseExecutor = options.phaseExecutor ?? executePhase;
  const now = options.now ?? (() => new Date());

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

  function appendTransition(input: {
    runId: string;
    fromStatus: InvestigationRecord['status'];
    toStatus: InvestigationRecord['status'];
    reason: string;
    logDate: string;
    phaseId?: string;
    schedulerSlot?: string;
    nextEligibleSlot?: string;
    waitingReason?: string;
    waitCondition?: InvestigationRecord['waitCondition'];
    retryIndex?: number;
  }): void {
    assertLegalTransition(input.fromStatus, input.toStatus);
    store.appendEvent({
      logDate: input.logDate,
      event: {
        eventType: 'LIFECYCLE_TRANSITION_RECORDED',
        investigationRunId: input.runId,
        ...(input.phaseId ? { phaseId: input.phaseId } : {}),
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reason: input.reason,
        ...(input.schedulerSlot ? { schedulerSlot: input.schedulerSlot } : {}),
        ...(input.nextEligibleSlot ? { nextEligibleSlot: input.nextEligibleSlot } : {}),
        ...(input.waitingReason ? { waitingReason: input.waitingReason } : {}),
        ...(input.waitCondition ? { waitCondition: input.waitCondition } : {}),
        ...(input.retryIndex !== undefined ? { retryIndex: input.retryIndex } : {})
      }
    });
  }

  function hasNewDatasetObservation(record: InvestigationRecord, sourceSignal: SignalRecord): boolean {
    const candidates = signalStore.listSignals({ signalType: sourceSignal.signalType })
      .filter((signal) => signal.dataset === sourceSignal.dataset)
      .filter((signal) => signal.dedupeKey !== sourceSignal.dedupeKey)
      .filter((signal) => signal.slot.localeCompare(record.slot) > 0)
      .sort((left, right) => right.slot.localeCompare(left.slot));

    return candidates.length > 0;
  }

  function ensureCompletedReport(runId: string, definition: InvestigationDefinition, logDate: string): void {
    const currentRecord = store.getInvestigation(runId);
    if (currentRecord.finalReportPath) {
      return;
    }

    const reportArtifacts = writeInvestigationReport({
      artifactsRoot: resolvedArtifactsRoot,
      record: currentRecord,
      definition,
      history: store.getInvestigationHistory(runId)
    });

    [reportArtifacts.jsonPath, reportArtifacts.markdownPath]
      .sort((left, right) => left.localeCompare(right))
      .forEach((artifact) => {
        recordArtifact(logDate, runId, artifact, 'finalize');
      });

    store.appendEvent({
      logDate,
      event: {
        eventType: 'INVESTIGATION_COMPLETED',
        investigationRunId: runId,
        finalReportPath: reportArtifacts.markdownPath,
        findings: currentRecord.findings
      }
    });
  }

  function advanceInvestigationForSlot(input: {
    runId: string;
    launchRequest: InvestigationLaunchRequest;
    sourceSignal: SignalRecord;
    schedulerSlot: string;
    logDate: string;
  }): { advanced: boolean; record: InvestigationRecord } {
    const definition = registry.getInvestigation(store.getInvestigation(input.runId).investigationDefinitionId);
    let advanced = false;

    for (;;) {
      const record = store.getInvestigation(input.runId);
      const phase = resolveNextPhase(record, definition.phases);
      if (!phase) {
        if (record.status !== 'completed') {
          appendTransition({
            runId: input.runId,
            fromStatus: record.status,
            toStatus: 'completed',
            reason: 'all_phases_completed',
            logDate: input.logDate,
            schedulerSlot: input.schedulerSlot,
            phaseId: record.currentPhaseId
          });
          ensureCompletedReport(input.runId, definition, input.logDate);
          advanced = true;
        }
        break;
      }

      if (store.hasPhaseAdvancementForSlot({
        investigationRunId: input.runId,
        phaseId: phase.phaseId,
        schedulerSlot: input.schedulerSlot
      })) {
        break;
      }

      const dueDecision = evaluateDue({
        record,
        currentSlotId: input.schedulerSlot,
        phaseExists: true,
        alreadyAdvancedForSlot: false,
        dataConditionSatisfied: hasNewDatasetObservation(record, input.sourceSignal)
      });

      if (dueDecision !== 'due') {
        break;
      }

      if ((phase.executionMode === 'next_tick' || phase.executionMode === 'delayed')
        && !(record.status === 'scheduled_resume' && record.currentPhaseId === phase.phaseId)) {
        const delay = Math.max(phase.executionMode === 'next_tick' ? 1 : (phase.minDelaySlots ?? 1), 1);
        const nextEligibleSlot = computeNextEligibleSlot({ currentSlotId: input.schedulerSlot, delaySlots: delay });
        store.appendEvent({
          logDate: input.logDate,
          event: {
            eventType: 'PHASE_SCHEDULED_RESUME',
            investigationRunId: input.runId,
            phaseId: phase.phaseId,
            reason: 'phase_scheduled_delay',
            nextEligibleSlot,
            schedulerSlot: input.schedulerSlot
          }
        });
        appendTransition({
          runId: input.runId,
          fromStatus: record.status,
          toStatus: 'scheduled_resume',
          reason: 'phase_scheduled_delay',
          logDate: input.logDate,
          schedulerSlot: input.schedulerSlot,
          phaseId: phase.phaseId,
          nextEligibleSlot,
          waitingReason: 'phase_scheduled_delay'
        });
        advanced = true;
        break;
      }

      if (phase.waitCondition === 'new_dataset_observation' && !hasNewDatasetObservation(record, input.sourceSignal)) {
        const nextEligibleSlot = phase.minDelaySlots && phase.minDelaySlots > 0
          ? computeNextEligibleSlot({ currentSlotId: input.schedulerSlot, delaySlots: phase.minDelaySlots })
          : undefined;
        store.appendEvent({
          logDate: input.logDate,
          event: {
            eventType: 'PHASE_WAITING_FOR_DATA',
            investigationRunId: input.runId,
            phaseId: phase.phaseId,
            reason: 'awaiting_new_dataset_observation',
            waitCondition: 'new_dataset_observation',
            ...(nextEligibleSlot ? { nextEligibleSlot } : {}),
            schedulerSlot: input.schedulerSlot
          }
        });
        appendTransition({
          runId: input.runId,
          fromStatus: record.status,
          toStatus: 'awaiting_data',
          reason: 'awaiting_new_dataset_observation',
          logDate: input.logDate,
          schedulerSlot: input.schedulerSlot,
          phaseId: phase.phaseId,
          ...(nextEligibleSlot ? { nextEligibleSlot } : {}),
          waitingReason: 'awaiting_new_dataset_observation',
          waitCondition: 'new_dataset_observation'
        });
        advanced = true;
        break;
      }

      store.appendEvent({
        logDate: input.logDate,
        event: {
          eventType: 'PHASE_SLOT_ADVANCEMENT_RECORDED',
          investigationRunId: input.runId,
          phaseId: phase.phaseId,
          schedulerSlot: input.schedulerSlot
        }
      });
      appendTransition({
        runId: input.runId,
        fromStatus: record.status,
        toStatus: 'running',
        reason: 'phase_started',
        logDate: input.logDate,
        phaseId: phase.phaseId,
        schedulerSlot: input.schedulerSlot
      });
      store.appendEvent({
        logDate: input.logDate,
        event: {
          eventType: 'PHASE_STARTED',
          investigationRunId: input.runId,
          phaseId: phase.phaseId,
          phaseKind: phase.kind,
          schedulerSlot: input.schedulerSlot
        }
      });

      try {
        const phaseResult = phaseExecutor({
          phase,
          definition,
          signal: input.sourceSignal,
          launchRequest: input.launchRequest,
          runId: input.runId,
          artifactsRoot: resolvedArtifactsRoot
        });

        if (phaseResult.outcome === 'scheduled_resume') {
          const nextEligibleSlot = phaseResult.nextEligibleSlot
            ?? computeNextEligibleSlot({
              currentSlotId: input.schedulerSlot,
              delaySlots: Math.max(phase.minDelaySlots ?? 1, 1)
            });
          store.appendEvent({
            logDate: input.logDate,
            event: {
              eventType: 'PHASE_SCHEDULED_RESUME',
              investigationRunId: input.runId,
              phaseId: phase.phaseId,
              reason: phaseResult.reason ?? 'phase_scheduled_resume',
              nextEligibleSlot,
              schedulerSlot: input.schedulerSlot
            }
          });
          appendTransition({
            runId: input.runId,
            fromStatus: 'running',
            toStatus: 'scheduled_resume',
            reason: phaseResult.reason ?? 'phase_scheduled_resume',
            logDate: input.logDate,
            phaseId: phase.phaseId,
            schedulerSlot: input.schedulerSlot,
            nextEligibleSlot,
            waitingReason: phaseResult.reason ?? 'phase_scheduled_resume'
          });
          advanced = true;
          break;
        }

        if (phaseResult.outcome === 'awaiting_data') {
          const nextEligibleSlot = phaseResult.nextEligibleSlot;
          store.appendEvent({
            logDate: input.logDate,
            event: {
              eventType: 'PHASE_WAITING_FOR_DATA',
              investigationRunId: input.runId,
              phaseId: phase.phaseId,
              reason: phaseResult.reason ?? 'awaiting_data',
              waitCondition: phase.waitCondition ?? 'new_dataset_observation',
              ...(nextEligibleSlot ? { nextEligibleSlot } : {}),
              schedulerSlot: input.schedulerSlot
            }
          });
          appendTransition({
            runId: input.runId,
            fromStatus: 'running',
            toStatus: 'awaiting_data',
            reason: phaseResult.reason ?? 'awaiting_data',
            logDate: input.logDate,
            schedulerSlot: input.schedulerSlot,
            phaseId: phase.phaseId,
            ...(nextEligibleSlot ? { nextEligibleSlot } : {}),
            waitingReason: phaseResult.reason ?? 'awaiting_data',
            waitCondition: phase.waitCondition ?? 'new_dataset_observation'
          });
          advanced = true;
          break;
        }

        phaseResult.artifacts
          .sort((left, right) => left.localeCompare(right))
          .forEach((artifact) => {
            recordArtifact(input.logDate, input.runId, artifact, phase.kind);
          });

        store.appendEvent({
          logDate: input.logDate,
          event: {
            eventType: 'PHASE_COMPLETED',
            investigationRunId: input.runId,
            phaseId: phase.phaseId,
            phaseKind: phase.kind,
            findings: uniqueSorted(phaseResult.findings)
          }
        });
        advanced = true;
        continue;
      } catch (error) {
        if (error instanceof InvestigationAwaitingDataError) {
          store.appendEvent({
            logDate: input.logDate,
            event: {
              eventType: 'PHASE_WAITING_FOR_DATA',
              investigationRunId: input.runId,
              phaseId: phase.phaseId,
              reason: error.message,
              waitCondition: phase.waitCondition ?? 'new_dataset_observation',
              schedulerSlot: input.schedulerSlot
            }
          });
          appendTransition({
            runId: input.runId,
            fromStatus: 'running',
            toStatus: 'awaiting_data',
            reason: error.message,
            logDate: input.logDate,
            schedulerSlot: input.schedulerSlot,
            phaseId: phase.phaseId,
            waitingReason: error.message,
            waitCondition: phase.waitCondition ?? 'new_dataset_observation'
          });
          advanced = true;
          break;
        }

        const disposition = classifyPhaseFailure({ phase, error });
        const current = store.getInvestigation(input.runId);
        const currentRetry = current.retryCountByPhase[phase.phaseId] ?? 0;
        const retryLimit = maxRetriesForPhase(phase);

        if (disposition === 'retryable' && currentRetry < retryLimit) {
          const retryIndex = currentRetry + 1;
          const nextEligibleSlot = computeNextEligibleSlot({
            currentSlotId: input.schedulerSlot,
            delaySlots: Math.max(phase.minDelaySlots ?? retryIndex, 1)
          });

          store.appendEvent({
            logDate: input.logDate,
            event: {
              eventType: 'PHASE_RETRY_SCHEDULED',
              investigationRunId: input.runId,
              phaseId: phase.phaseId,
              reason: error instanceof Error ? error.message : 'phase_retry_scheduled',
              retryIndex,
              nextEligibleSlot,
              schedulerSlot: input.schedulerSlot
            }
          });
          appendTransition({
            runId: input.runId,
            fromStatus: 'running',
            toStatus: 'retry_pending',
            reason: error instanceof Error ? error.message : 'phase_retry_scheduled',
            logDate: input.logDate,
            schedulerSlot: input.schedulerSlot,
            phaseId: phase.phaseId,
            nextEligibleSlot,
            waitingReason: 'retry_pending',
            retryIndex
          });
          advanced = true;
          break;
        }

        appendTransition({
          runId: input.runId,
          fromStatus: 'running',
          toStatus: 'failed',
          reason: error instanceof Error ? error.message : 'investigation_execution_failed',
          logDate: input.logDate,
          schedulerSlot: input.schedulerSlot,
          phaseId: phase.phaseId
        });
        store.appendEvent({
          logDate: input.logDate,
          event: {
            eventType: 'INVESTIGATION_FAILED',
            investigationRunId: input.runId,
            phaseId: phase.phaseId,
            reason: error instanceof Error ? error.message : 'investigation_execution_failed'
          }
        });
        advanced = true;
        break;
      }
    }

    return {
      advanced,
      record: store.getInvestigation(input.runId)
    };
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

    const advanced = advanceInvestigationForSlot({
      runId: investigationRunId,
      launchRequest,
      sourceSignal: signal,
      schedulerSlot: signal.slot,
      logDate: signal.logDate
    });

    if (advanced.record.status === 'failed') {
      return {
        status: 'failed',
        record: advanced.record
      };
    }

    return {
      status: 'started',
      record: advanced.record
    };
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

  function launchRequestForRecord(record: InvestigationRecord): InvestigationLaunchRequest {
    return {
      missionId: record.associatedMissionReferences[0] ?? 'n/a',
      triggerId: record.sourceTriggerId ?? 'n/a',
      sourceSignal: record.sourceSignalReference
    };
  }

  function evaluateDueForSlot(record: InvestigationRecord, schedulerSlot: string): InvestigationDueDecision {
    const definition = registry.getInvestigation(record.investigationDefinitionId);
    const phase = resolveNextPhase(record, definition.phases);
    if (!phase) {
      return 'terminal';
    }
    return evaluateDue({
      record,
      currentSlotId: schedulerSlot,
      phaseExists: Boolean(phase),
      alreadyAdvancedForSlot: store.hasPhaseAdvancementForSlot({
        investigationRunId: record.investigationRunId,
        phaseId: phase.phaseId,
        schedulerSlot
      }),
      dataConditionSatisfied: hasNewDatasetObservation(record, resolveSignal(record.sourceSignalReference))
    });
  }

  function listDueInvestigations(input: { schedulerSlot: string }): InvestigationDueItem[] {
    return store.listInvestigations()
      .filter((record) => !['completed', 'failed', 'cancelled'].includes(record.status))
      .map((record) => {
        const definition = registry.getInvestigation(record.investigationDefinitionId);
        const nextPhase = resolveNextPhase(record, definition.phases);
        const dueDecision = evaluateDueForSlot(record, input.schedulerSlot);
        return {
          investigationRunId: record.investigationRunId,
          investigationDefinitionId: record.investigationDefinitionId,
          status: record.status,
          ...(record.currentPhaseId ? { currentPhaseId: record.currentPhaseId } : {}),
          ...(nextPhase ? { nextPhaseId: nextPhase.phaseId } : {}),
          ...(record.nextEligibleSlot ? { nextEligibleSlot: record.nextEligibleSlot } : {}),
          dueNow: dueDecision === 'due',
          dueReason: dueDecision,
          ...(record.waitingReason ? { waitingReason: record.waitingReason } : {}),
          retryCountByPhase: record.retryCountByPhase
        };
      })
      .sort(compareDueItem);
  }

  function advanceDueInvestigations(input: { schedulerSlot: string; logDate?: string }) {
    const logDate = input.logDate ?? deriveLogDateFromSlot(input.schedulerSlot, todayUtcIsoDate(now()));
    const due = listDueInvestigations({ schedulerSlot: input.schedulerSlot });
    const advancedRuns: string[] = [];

    for (const item of due) {
      if (!item.dueNow) {
        continue;
      }
      const current = store.getInvestigation(item.investigationRunId);
      const sourceSignal = resolveSignal(current.sourceSignalReference);
      const advanced = advanceInvestigationForSlot({
        runId: current.investigationRunId,
        launchRequest: launchRequestForRecord(current),
        sourceSignal,
        schedulerSlot: input.schedulerSlot,
        logDate
      });
      if (advanced.advanced) {
        advancedRuns.push(current.investigationRunId);
      }
    }

    return {
      schedulerSlot: input.schedulerSlot,
      logDate,
      advancedInvestigations: advancedRuns.sort((left, right) => left.localeCompare(right)),
      due: listDueInvestigations({ schedulerSlot: input.schedulerSlot })
    };
  }

  return {
    executeLaunchRequest,
    executeLaunchRequests,
    advanceDueInvestigations,
    listDueInvestigations,
    listInvestigations: store.listInvestigations,
    getInvestigation: store.getInvestigation,
    investigationsRootDir: resolvedInvestigationsRoot,
    investigationArtifactsRoot: resolvedArtifactsRoot
  };
}

export type InvestigationExecutor = ReturnType<typeof createInvestigationExecutor>;
