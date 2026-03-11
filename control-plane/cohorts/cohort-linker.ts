import { createInvestigationStore, type InvestigationStore } from '../investigations/investigation-store.ts';
import type { InvestigationRecord } from '../investigations/investigation-types.ts';
import { createSignalStore, type SignalStore } from '../signals/signal-store.ts';
import type { SignalRecord } from '../signals/signal-types.ts';
import { createSynthesisInspection, type SynthesisInspection } from '../synthesis/synthesis-inspection.ts';

import { createCohortRegistry, type CohortRegistry } from './cohort-registry.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function splitSubjectToken(subjectKey: string): string {
  const trimmed = normalizeToken(subjectKey);
  const parts = trimmed.split(':');
  return parts[parts.length - 1] ?? trimmed;
}

function eventFamily(signalType: string): string {
  return normalizeToken(signalType).split('_')[0] ?? normalizeToken(signalType);
}

function triggerFamily(triggerId: string | undefined): string {
  if (!triggerId) {
    return '';
  }
  return normalizeToken(triggerId).split('-')[0] ?? normalizeToken(triggerId);
}

function cohortFamily(cohortType: string): string {
  return normalizeToken(cohortType).split('-')[0] ?? normalizeToken(cohortType);
}

function sourceSignal(signalStore: SignalStore, investigation: InvestigationRecord): SignalRecord | null {
  return signalStore.getSignalByDedupeKey(investigation.sourceSignalReference);
}

function protocolOf(signal: SignalRecord | null): string {
  const protocol = signal?.metadata.protocol;
  return typeof protocol === 'string' ? normalizeToken(protocol) : '';
}

function assetOf(signal: SignalRecord | null): string {
  const asset = signal?.metadata.asset;
  return typeof asset === 'string' ? normalizeToken(asset) : '';
}

function cohortDefinitionMatchesInvestigation(input: {
  cohortType: string;
  investigationDefinitionId: string;
  sourceSignalType: string;
}): boolean {
  const cohortType = normalizeToken(input.cohortType);
  const cohortTypeAsSignal = cohortType.replace(/-/g, '_');
  const investigationDefinitionId = normalizeToken(input.investigationDefinitionId);
  const sourceSignalType = normalizeToken(input.sourceSignalType);
  const family = cohortFamily(cohortType);

  return investigationDefinitionId.includes(cohortType)
    || sourceSignalType.includes(cohortTypeAsSignal)
    || investigationDefinitionId.includes(family)
    || sourceSignalType.includes(family);
}

function cohortDefinitionMatchesSynthesis(input: {
  cohortType: string;
  synthesisType: string;
}): boolean {
  const cohortType = normalizeToken(input.cohortType);
  const synthesisType = normalizeToken(input.synthesisType);
  const family = cohortFamily(cohortType);
  return synthesisType.includes(cohortType) || synthesisType.includes(family);
}

function subjectMatches(cohortSubjectKey: string, synthesisSubjectKey: string): boolean {
  const cohortSubject = normalizeToken(cohortSubjectKey);
  const synthesisSubject = normalizeToken(synthesisSubjectKey);
  if (cohortSubject === synthesisSubject) {
    return true;
  }
  const synthesisParts = synthesisSubject.split(':');
  return (synthesisParts[synthesisParts.length - 1] ?? '') === cohortSubject;
}

export interface CohortLinkProjection {
  cohortId: string;
  linkedInvestigations: string[];
  linkedSyntheses: string[];
}

export function createCohortLinker(options: {
  registry?: CohortRegistry;
  investigationStore?: InvestigationStore;
  signalStore?: SignalStore;
  synthesisInspection?: SynthesisInspection;
  definitionsDir?: string;
  investigationsRootDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  investigationDefinitionsDir?: string;
  investigationArtifactsRoot?: string;
  synthesisArtifactsRoot?: string;
} = {}) {
  const registry = options.registry ?? createCohortRegistry({ definitionsDir: options.definitionsDir });
  const investigationStore = options.investigationStore ?? createInvestigationStore({ rootDir: options.investigationsRootDir });
  const signalStore = options.signalStore ?? createSignalStore({ rootDir: options.signalsRootDir });
  const synthesisInspection = options.synthesisInspection ?? createSynthesisInspection({
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });

  function investigationMatchesCohort(investigation: InvestigationRecord, cohortId: string): boolean {
    const definition = registry.getCohortDefinition(cohortId);
    const signal = sourceSignal(signalStore, investigation);
    const subject = splitSubjectToken(definition.subjectKey);
    const protocol = protocolOf(signal);
    const asset = assetOf(signal);
    const cohortTypeFamily = cohortFamily(definition.cohortType);

    const checks: boolean[] = [];

    if (definition.linkRules.sharedProtocol) {
      checks.push(protocol.length > 0 && protocol === subject);
    }
    if (definition.linkRules.sharedAsset) {
      checks.push(asset.length > 0 && asset === subject);
    }
    if (definition.linkRules.sharedEventFamily) {
      checks.push(eventFamily(investigation.sourceSignalType) === cohortTypeFamily);
    }
    if (definition.linkRules.sharedTriggerFamily) {
      checks.push(triggerFamily(investigation.sourceTriggerId) === cohortTypeFamily);
    }
    if (definition.linkRules.cohortDefinitionMatch) {
      checks.push(cohortDefinitionMatchesInvestigation({
        cohortType: definition.cohortType,
        investigationDefinitionId: investigation.investigationDefinitionId,
        sourceSignalType: investigation.sourceSignalType
      }));
    }

    return checks.length > 0 && checks.every((entry) => entry);
  }

  function synthesisMatchesCohort(input: {
    synthesisId: string;
    synthesisType: string;
    subjectKey: string;
  }, cohortId: string): boolean {
    const definition = registry.getCohortDefinition(cohortId);
    if (!subjectMatches(definition.subjectKey, input.subjectKey)) {
      return false;
    }
    if (definition.linkRules.cohortDefinitionMatch) {
      return cohortDefinitionMatchesSynthesis({
        cohortType: definition.cohortType,
        synthesisType: input.synthesisType
      });
    }
    return true;
  }

  function buildLinks(): CohortLinkProjection[] {
    const investigations = investigationStore.listInvestigations()
      .sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));

    const syntheses = synthesisInspection.listSynthesisSets()
      .sort((left, right) => left.synthesisId.localeCompare(right.synthesisId));

    return registry.listCohorts()
      .map((definition) => {
        const linkedInvestigations = uniqueSorted(investigations
          .filter((investigation) => investigationMatchesCohort(investigation, definition.cohortId))
          .map((investigation) => investigation.investigationRunId));

        const linkedSyntheses = uniqueSorted(syntheses
          .filter((synthesis) => synthesisMatchesCohort({
            synthesisId: synthesis.synthesisId,
            synthesisType: synthesis.synthesisType,
            subjectKey: synthesis.subjectKey
          }, definition.cohortId))
          .map((synthesis) => synthesis.synthesisId));

        return {
          cohortId: definition.cohortId,
          linkedInvestigations,
          linkedSyntheses
        } satisfies CohortLinkProjection;
      })
      .sort((left, right) => left.cohortId.localeCompare(right.cohortId));
  }

  return {
    buildLinks
  };
}

export type CohortLinker = ReturnType<typeof createCohortLinker>;
