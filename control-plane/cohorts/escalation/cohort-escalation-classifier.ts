import { createInvestigationInspection, type InvestigationInspection } from '../../investigations/investigation-inspection.ts';
import { createSignalStore, type SignalStore } from '../../signals/signal-store.ts';
import { createSynthesisInspection, type SynthesisInspection } from '../../synthesis/synthesis-inspection.ts';

import { createCohortProjection, type CohortProjectionEngine } from '../cohort-projection.ts';
import { createCohortProgramRegistry, type CohortProgramRegistry } from '../programs/program-registry.ts';

import type { CohortEscalationProjection } from './cohort-escalation-types.ts';

const ADVERSE_SIGNAL_TYPES = ['protocol_risk', 'liquidity_drain', 'yield_anomaly', 'large_token_unlock'] as const;

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function subjectToken(value: string): string {
  const lowered = value.trim().toLowerCase();
  const parts = lowered.split(':');
  return parts[parts.length - 1] ?? lowered;
}

function parseDate(input: string): Date | null {
  const match = /(\d{4}-\d{2}-\d{2})/.exec(input);
  if (!match?.[1]) {
    return null;
  }

  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function listWindowDates(anchorDate: Date, days: number): string[] {
  const dates: string[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const cursor = new Date(anchorDate);
    cursor.setUTCDate(cursor.getUTCDate() - offset);
    dates.push(formatDate(cursor));
  }
  return uniqueSorted(dates);
}

function compareEscalation(left: number, right: number): number {
  return left - right;
}

function escalationStateFromScore(score: number): CohortEscalationProjection['escalationState'] {
  if (score >= 3) {
    return 'critical';
  }
  if (score === 2) {
    return 'escalated';
  }
  if (score === 1) {
    return 'elevated';
  }
  return 'none';
}

export function createCohortEscalationClassifier(options: {
  cohortProjection?: CohortProjectionEngine;
  synthesisInspection?: SynthesisInspection;
  investigationInspection?: InvestigationInspection;
  signalStore?: SignalStore;
  programRegistry?: CohortProgramRegistry;
  cohortDefinitionsDir?: string;
  cohortProgramDefinitionsDir?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const now = options.now ?? (() => new Date());
  const cohortProjection = options.cohortProjection ?? createCohortProjection({
    definitionsDir: options.cohortDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });
  const synthesisInspection = options.synthesisInspection ?? createSynthesisInspection({
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });
  const investigationInspection = options.investigationInspection ?? createInvestigationInspection({
    definitionsDir: options.investigationDefinitionsDir,
    rootDir: options.investigationsRootDir,
    artifactsRoot: options.investigationArtifactsRoot
  });
  const signalStore = options.signalStore ?? createSignalStore({
    rootDir: options.signalsRootDir
  });
  const programRegistry = options.programRegistry ?? createCohortProgramRegistry({
    definitionsDir: options.cohortProgramDefinitionsDir
  });

  function classifyCohort(input: { cohortId: string; slotOrReference?: string }): CohortEscalationProjection {
    const projected = cohortProjection.projectOne(input.cohortId).cohort;
    const anchorDate = parseDate(input.slotOrReference ?? '') ?? new Date(`${now().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const windowDates = listWindowDates(anchorDate, 7);
    const subject = subjectToken(projected.subjectKey);

    const adverseSignals = signalStore.listSignals()
      .filter((entry) => (ADVERSE_SIGNAL_TYPES as readonly string[]).includes(entry.signalType))
      .filter((entry) => windowDates.includes(entry.logDate))
      .filter((entry) => {
        const protocol = typeof entry.metadata.protocol === 'string'
          ? subjectToken(entry.metadata.protocol)
          : '';
        return protocol.length === 0 || protocol === subject;
      })
      .sort((left, right) => left.dedupeKey.localeCompare(right.dedupeKey));

    const synthesisInconclusive = projected.linkedSyntheses
      .map((synthesisId) => ({
        synthesisId,
        status: synthesisInspection.inspectStatus(synthesisId).readinessState
      }))
      .filter((entry) => entry.status === 'inconclusive')
      .map((entry) => entry.synthesisId)
      .sort((left, right) => left.localeCompare(right));

    const degradedInvestigations = projected.linkedInvestigations
      .map((investigationRunId) => ({
        investigationRunId,
        status: investigationInspection.inspectCompletionStatus(investigationRunId).healthState
      }))
      .filter((entry) => entry.status === 'degraded' || entry.status === 'unhealthy' || entry.status === 'inconclusive')
      .map((entry) => entry.investigationRunId)
      .sort((left, right) => left.localeCompare(right));

    const reasons: string[] = [];
    const severities: number[] = [0];

    if (projected.healthState === 'degraded') {
      reasons.push('cohort_health_degraded');
      severities.push(1);
    }
    if (projected.healthState === 'conflicted') {
      reasons.push('cohort_health_conflicted');
      severities.push(2);
    }
    if (projected.healthState === 'unstable') {
      reasons.push('cohort_health_unstable');
      severities.push(3);
    }

    if (projected.readinessState === 'incomplete' || projected.readinessState === 'inconclusive') {
      reasons.push(`cohort_readiness_${projected.readinessState}`);
      severities.push(1);
    }

    if (synthesisInconclusive.length > 0) {
      reasons.push('synthesis_inconclusive_window');
      severities.push(2);
    }

    if (degradedInvestigations.length >= 2) {
      reasons.push('repeated_investigation_confidence_degradation');
      severities.push(2);
    } else if (degradedInvestigations.length === 1) {
      reasons.push('investigation_confidence_degradation');
      severities.push(1);
    }

    if (adverseSignals.length >= 5) {
      reasons.push('repeated_adverse_signals_critical_window');
      severities.push(3);
    } else if (adverseSignals.length >= 3) {
      reasons.push('repeated_adverse_signals_escalated_window');
      severities.push(2);
    } else if (adverseSignals.length > 0) {
      reasons.push('adverse_signals_elevated_window');
      severities.push(1);
    }

    const escalationScore = severities.sort(compareEscalation)[severities.length - 1] ?? 0;

    return {
      cohortId: input.cohortId,
      escalationState: escalationStateFromScore(escalationScore),
      escalationReasons: uniqueSorted(reasons),
      linkedSignals: uniqueSorted(adverseSignals.map((entry) => entry.dedupeKey)),
      linkedSyntheses: uniqueSorted(synthesisInconclusive),
      linkedInvestigations: uniqueSorted(degradedInvestigations),
      linkedProgramIds: programRegistry.listPrograms({ cohortId: input.cohortId }).map((entry) => entry.programId),
      slotOrReference: input.slotOrReference ?? `daily:${formatDate(anchorDate)}`
    };
  }

  return {
    classifyCohort
  };
}

export type CohortEscalationClassifier = ReturnType<typeof createCohortEscalationClassifier>;
