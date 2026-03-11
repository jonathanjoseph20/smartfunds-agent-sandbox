import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { createSignalStore, type SignalStore } from '../signals/signal-store.ts';
import type { SignalRecord } from '../signals/signal-types.ts';
import {
  type InvestigationStore,
  createInvestigationStore
} from '../investigations/investigation-store.ts';
import type { InvestigationRecord } from '../investigations/investigation-types.ts';

import type { SynthesisRegistry } from './synthesis-registry.ts';
import { createSynthesisRegistry } from './synthesis-registry.ts';
import type { SynthesisDefinition, SynthesisIdentity, SynthesisLinkReason } from './synthesis-types.ts';

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function uniqueReasons(reasons: SynthesisLinkReason[]): SynthesisLinkReason[] {
  const byKey = new Map<string, SynthesisLinkReason>();
  for (const reason of reasons) {
    const key = `${reason.dimension}:${reason.value}:${reason.reason}`;
    if (!byKey.has(key)) {
      byKey.set(key, reason);
    }
  }
  return Array.from(byKey.values()).sort((left, right) => {
    const d = left.dimension.localeCompare(right.dimension);
    if (d !== 0) {
      return d;
    }
    const v = left.value.localeCompare(right.value);
    if (v !== 0) {
      return v;
    }
    return left.reason.localeCompare(right.reason);
  });
}

function normalizeProtocol(protocol: string): string {
  return protocol.trim().toLowerCase();
}

function signalForInvestigation(signalStore: SignalStore, investigation: InvestigationRecord): SignalRecord | null {
  return signalStore.getSignalByDedupeKey(investigation.sourceSignalReference);
}

function dimensionsForInvestigation(input: {
  definition: SynthesisDefinition;
  investigation: InvestigationRecord;
  signal: SignalRecord | null;
}): Array<{ dimension: string; value: string; reason: string }> {
  const rows: Array<{ dimension: string; value: string; reason: string }> = [];
  const signalType = input.investigation.sourceSignalType;

  if (input.definition.supportedDimensions.includes('signal_type')) {
    rows.push({
      dimension: 'signal_type',
      value: signalType,
      reason: `same signalType=${signalType}`
    });
  }

  if (input.definition.supportedDimensions.includes('trigger_family') && input.investigation.sourceTriggerId) {
    rows.push({
      dimension: 'trigger_family',
      value: input.investigation.sourceTriggerId,
      reason: `same triggerFamily=${input.investigation.sourceTriggerId}`
    });
  }

  const metadata = input.signal?.metadata ?? {};

  if (input.definition.supportedDimensions.includes('protocol')) {
    const protocol = asTrimmedString(metadata.protocol);
    if (protocol) {
      const normalized = normalizeProtocol(protocol);
      rows.push({
        dimension: 'protocol',
        value: normalized,
        reason: `same protocol=${normalized}`
      });
    }
  }

  if (input.definition.supportedDimensions.includes('asset')) {
    const asset = asTrimmedString(metadata.asset);
    if (asset) {
      rows.push({
        dimension: 'asset',
        value: asset.toLowerCase(),
        reason: `same asset=${asset.toLowerCase()}`
      });
    }
  }

  if (input.definition.supportedDimensions.includes('subject_tag')) {
    const tag = asTrimmedString(metadata.subjectTag);
    if (tag) {
      rows.push({
        dimension: 'subject_tag',
        value: tag.toLowerCase(),
        reason: `same subjectTag=${tag.toLowerCase()}`
      });
    }
  }

  return rows.sort((left, right) => {
    const d = left.dimension.localeCompare(right.dimension);
    if (d !== 0) {
      return d;
    }
    return left.value.localeCompare(right.value);
  });
}

function synthesisId(identity: SynthesisIdentity): string {
  return sha256(canonicalStringify(identity));
}

export type SynthesisLinkProjection = {
  synthesisId: string;
  synthesisType: string;
  subjectKey: string;
  linkedInvestigationIds: string[];
  linkedReasons: SynthesisLinkReason[];
};

export function createSynthesisLinker(options: {
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

  function buildLinks(): SynthesisLinkProjection[] {
    const links = new Map<string, SynthesisLinkProjection>();
    const investigations = investigationStore.listInvestigations();

    for (const definition of registry.listDefinitions()) {
      const eligible = investigations
        .filter((record) => definition.sourceSignalTypes.includes(record.sourceSignalType))
        .filter((record) => definition.sourceInvestigationDefinitionIds.includes(record.investigationDefinitionId))
        .sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));

      for (const investigation of eligible) {
        const signal = signalForInvestigation(signalStore, investigation);
        const dims = dimensionsForInvestigation({ definition, investigation, signal });

        for (const dim of dims) {
          const subjectKey = `${dim.dimension}:${dim.value}`;
          const identity: SynthesisIdentity = {
            synthesisType: definition.synthesisType,
            subjectKey
          };
          const nextSynthesisId = synthesisId(identity);
          const key = `${definition.synthesisType}:${subjectKey}`;
          const existing = links.get(key) ?? {
            synthesisId: nextSynthesisId,
            synthesisType: definition.synthesisType,
            subjectKey,
            linkedInvestigationIds: [],
            linkedReasons: []
          };

          existing.linkedInvestigationIds = uniqueSorted([
            ...existing.linkedInvestigationIds,
            investigation.investigationRunId
          ]);
          existing.linkedReasons = uniqueReasons([
            ...existing.linkedReasons,
            {
              dimension: dim.dimension as SynthesisLinkReason['dimension'],
              value: dim.value,
              reason: dim.reason
            }
          ]);

          links.set(key, existing);
        }
      }
    }

    return Array.from(links.values())
      .sort((left, right) => {
        const typeCmp = left.synthesisType.localeCompare(right.synthesisType);
        if (typeCmp !== 0) {
          return typeCmp;
        }
        return left.subjectKey.localeCompare(right.subjectKey);
      });
  }

  return {
    buildLinks
  };
}

export type SynthesisLinker = ReturnType<typeof createSynthesisLinker>;
