import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { InvestigationStore } from './investigation-store.ts';

export function computeInvestigationDedupeKey(input: {
  investigationDefinitionId: string;
  sourceSignalReference: string;
  slot: string;
}): string {
  return sha256(canonicalStringify({
    investigationDefinitionId: input.investigationDefinitionId,
    sourceSignalReference: input.sourceSignalReference,
    slot: input.slot
  }));
}

export function computeInvestigationRunId(dedupeKey: string): string {
  return sha256(`investigation_run\n${dedupeKey}`);
}

export function createInvestigationDeduper(store: InvestigationStore) {
  function isDuplicateInvestigation(dedupeKey: string): boolean {
    return store.hasInvestigationByDedupeKey(dedupeKey);
  }

  return {
    isDuplicateInvestigation
  };
}

export type InvestigationDeduper = ReturnType<typeof createInvestigationDeduper>;
