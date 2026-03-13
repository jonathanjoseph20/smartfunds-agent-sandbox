import { describe, expect, it } from 'vitest';

import {
  computeVentureHistoryEventDedupeKey,
  createVentureHistoryStore,
} from '../../ventures/venture-history-store.ts';
import type { VentureDefinition, VentureStatusProjection } from '../../ventures/venture-types.ts';

function definition(overrides: Partial<VentureDefinition> = {}): VentureDefinition {
  return {
    ventureId: 'venture-1',
    ventureName: 'SmartFunds Core',
    ventureSlug: 'smartfunds-core',
    ventureClass: 'core_venture',
    ventureLifecycleState: 'incubating',
    ownershipModel: 'internal',
    operatingMode: 'manual',
    originMissionIds: ['mission-a'],
    linkedMissionPortfolioIds: [],
    linkedTeamIds: ['operations-team'],
    linkedEntityIds: ['core-entity'],
    summary: 'summary',
    domainTags: ['issuance'],
    productTypeTags: ['control-plane'],
    jurisdictionTags: ['us'],
    limitations: [],
    blockingReasons: [],
    provenanceInputs: {
      source: 'seed',
      referenceIds: ['ref-1'],
    },
    ...overrides,
  };
}

function status(): VentureStatusProjection {
  return {
    ventureId: 'venture-1',
    ventureLifecycleState: 'incubating',
    ventureStatus: 'active',
    limitations: [],
    blockingReasons: [],
  };
}

describe('venture history store', () => {
  it('T-VH1 append-only semantics and deterministic replay', () => {
    const store = createVentureHistoryStore();
    const first = store.replay({ definition: definition(), status: status() });
    const second = store.replay({ definition: definition(), status: status() });

    expect(first).toEqual(second);
    expect(new Set(first.entries.map((entry) => entry.eventDedupeKey)).size).toBe(first.entries.length);
  });

  it('T-VH2 deterministic ordering preserved', () => {
    const store = createVentureHistoryStore();
    const history = store.replay({ definition: definition(), status: status() });

    const sequences = history.entries.map((entry) => entry.sequence);
    expect([...sequences].sort((left, right) => left - right)).toEqual(sequences);
  });

  it('T-VH3 stable dedupe key generation', () => {
    const input = {
      ventureId: 'venture-1',
      eventType: 'venture_defined' as const,
      payload: { ventureClass: 'core_venture' },
      reasoning: 'seed',
      sequence: 1,
    };

    expect(computeVentureHistoryEventDedupeKey(input)).toBe(computeVentureHistoryEventDedupeKey(input));
  });
});
