import { createInvestigationStore, type InvestigationStore } from '../investigations/investigation-store.ts';
import { createSignalStore, type SignalStore } from '../signals/signal-store.ts';

import { createSynthesisRegistry, type SynthesisRegistry } from './synthesis-registry.ts';

export interface SynthesisLinkExplanation {
  synthesisId: string;
  linkedInvestigationId: string;
  subjectKey: string;
  linkReasons: string[];
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function parseSubjectKey(subjectKey: string): { dimension: string; value: string } {
  const index = subjectKey.indexOf(':');
  if (index <= 0) {
    return { dimension: 'unknown', value: normalize(subjectKey) };
  }
  return {
    dimension: normalize(subjectKey.slice(0, index)),
    value: normalize(subjectKey.slice(index + 1))
  };
}

function normalizeReasonOrder(reasons: string[]): string[] {
  const rank: Record<string, number> = {
    shared_protocol: 0,
    shared_asset: 1,
    shared_event_family: 2,
    shared_trigger_family: 3,
    synthesis_definition_match: 4
  };

  return uniqueSorted(reasons).sort((left, right) => {
    const leftRank = rank[left] ?? 99;
    const rightRank = rank[right] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.localeCompare(right);
  });
}

export function createSynthesisLinkExplanations(options: {
  registry?: SynthesisRegistry;
  investigationStore?: InvestigationStore;
  signalStore?: SignalStore;
  definitionsDir?: string;
  investigationsRootDir?: string;
  signalsRootDir?: string;
} = {}) {
  const registry = options.registry ?? createSynthesisRegistry({ definitionsDir: options.definitionsDir });
  const investigationStore = options.investigationStore ?? createInvestigationStore({ rootDir: options.investigationsRootDir });
  const signalStore = options.signalStore ?? createSignalStore({ rootDir: options.signalsRootDir });

  function explainLinksForSynthesis(input: {
    synthesisId: string;
    synthesisType: string;
    subjectKey: string;
    linkedInvestigationIds: string[];
  }): SynthesisLinkExplanation[] {
    const definition = registry.listDefinitions().find((entry) => entry.synthesisType === input.synthesisType);
    const subject = parseSubjectKey(input.subjectKey);
    const records = investigationStore
      .listInvestigations()
      .filter((entry) => input.linkedInvestigationIds.includes(entry.investigationRunId))
      .sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));

    return records.map((record) => {
      const reasons: string[] = [];
      const signal = signalStore.getSignalByDedupeKey(record.sourceSignalReference);
      const metadata = signal?.metadata ?? {};

      const protocol = typeof metadata.protocol === 'string' ? normalize(metadata.protocol) : null;
      const asset = typeof metadata.asset === 'string' ? normalize(metadata.asset) : null;
      const eventFamily = typeof metadata.eventFamily === 'string'
        ? normalize(metadata.eventFamily)
        : normalize(record.sourceSignalType.replace(/_/g, '-'));
      const triggerFamily = record.sourceTriggerId ? normalize(record.sourceTriggerId) : null;

      if ((subject.dimension === 'protocol' && protocol === subject.value) || protocol === subject.value) {
        reasons.push('shared_protocol');
      }

      if ((subject.dimension === 'asset' && asset === subject.value) || asset === subject.value) {
        reasons.push('shared_asset');
      }

      if (
        (subject.dimension === 'trigger_family' && triggerFamily === subject.value)
        || (subject.dimension === 'trigger-family' && triggerFamily === subject.value)
      ) {
        reasons.push('shared_trigger_family');
      }

      if (
        (subject.dimension === 'signal_type' && normalize(record.sourceSignalType) === subject.value)
        || eventFamily === subject.value
      ) {
        reasons.push('shared_event_family');
      }

      if (
        definition
        && definition.sourceSignalTypes.includes(record.sourceSignalType)
        && definition.sourceInvestigationDefinitionIds.includes(record.investigationDefinitionId)
      ) {
        reasons.push('synthesis_definition_match');
      }

      return {
        synthesisId: input.synthesisId,
        linkedInvestigationId: record.investigationRunId,
        subjectKey: input.subjectKey,
        linkReasons: normalizeReasonOrder(reasons)
      } satisfies SynthesisLinkExplanation;
    });
  }

  return {
    explainLinksForSynthesis
  };
}

export type SynthesisLinkExplanationEngine = ReturnType<typeof createSynthesisLinkExplanations>;
