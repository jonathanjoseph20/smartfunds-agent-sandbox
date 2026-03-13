import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  VentureDefinition,
  VentureHistoryEvent,
  VentureHistoryEventType,
  VentureStatusProjection,
} from './venture-types.ts';

function compareEvents(left: VentureHistoryEvent, right: VentureHistoryEvent): number {
  const sequenceCmp = left.sequence - right.sequence;
  if (sequenceCmp !== 0) {
    return sequenceCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

export function computeVentureHistoryEventDedupeKey(input: {
  ventureId: string;
  eventType: VentureHistoryEventType;
  payload: Record<string, unknown>;
  reasoning: string;
  sequence: number;
}): string {
  return sha256(canonicalStringify({
    ventureId: input.ventureId,
    eventType: input.eventType,
    payload: input.payload,
    reasoning: input.reasoning,
    sequence: input.sequence,
  }));
}

function withDeterministicEventIds(event: Omit<VentureHistoryEvent, 'eventDedupeKey' | 'eventId'>): VentureHistoryEvent {
  const eventDedupeKey = computeVentureHistoryEventDedupeKey(event);
  return {
    ...event,
    eventDedupeKey,
    eventId: sha256(canonicalStringify({
      ventureId: event.ventureId,
      sequence: event.sequence,
      eventDedupeKey,
    })),
  };
}

function createBaseEvents(input: {
  definition: VentureDefinition;
  status: VentureStatusProjection;
}): VentureHistoryEvent[] {
  const { definition, status } = input;

  const events: Array<Omit<VentureHistoryEvent, 'eventDedupeKey' | 'eventId'>> = [
    {
      ventureId: definition.ventureId ?? '',
      eventType: 'venture_defined',
      sequence: 1,
      reasoning: 'venture_definition_loaded',
      payload: {
        ventureClass: definition.ventureClass,
        ownershipModel: definition.ownershipModel,
        operatingMode: definition.operatingMode,
      },
    },
    {
      ventureId: definition.ventureId ?? '',
      eventType: 'venture_registered',
      sequence: 2,
      reasoning: 'venture_registry_loaded',
      payload: {
        ventureSlug: definition.ventureSlug,
      },
    },
    {
      ventureId: definition.ventureId ?? '',
      eventType: 'venture_status_changed',
      sequence: 3,
      reasoning: 'venture_status_derived',
      payload: {
        ventureStatus: status.ventureStatus,
      },
    },
  ];

  if (definition.ventureLifecycleState === 'incubating') {
    events.push({
      ventureId: definition.ventureId ?? '',
      eventType: 'venture_incubation_started',
      sequence: 4,
      reasoning: 'venture_lifecycle_incubating',
      payload: {
        ventureLifecycleState: definition.ventureLifecycleState,
      },
    });
  }

  if (definition.ventureLifecycleState === 'ready_for_launch') {
    events.push({
      ventureId: definition.ventureId ?? '',
      eventType: 'venture_marked_ready_for_launch',
      sequence: 4,
      reasoning: 'venture_lifecycle_ready_for_launch',
      payload: {
        ventureLifecycleState: definition.ventureLifecycleState,
      },
    });
  }

  if (definition.ventureLifecycleState === 'paused') {
    events.push({
      ventureId: definition.ventureId ?? '',
      eventType: 'venture_paused',
      sequence: 4,
      reasoning: 'venture_lifecycle_paused',
      payload: {
        ventureLifecycleState: definition.ventureLifecycleState,
      },
    });
  }

  if (definition.ventureLifecycleState === 'archived') {
    events.push({
      ventureId: definition.ventureId ?? '',
      eventType: 'venture_archived',
      sequence: 4,
      reasoning: 'venture_lifecycle_archived',
      payload: {
        ventureLifecycleState: definition.ventureLifecycleState,
      },
    });
  }

  for (const linkedTeamId of definition.linkedTeamIds) {
    events.push({
      ventureId: definition.ventureId ?? '',
      eventType: 'venture_team_linked',
      sequence: 5,
      reasoning: 'venture_linked_team_declared',
      payload: {
        linkedTeamId,
      },
    });
  }

  for (const missionId of definition.originMissionIds) {
    events.push({
      ventureId: definition.ventureId ?? '',
      eventType: 'venture_mission_linked',
      sequence: 6,
      reasoning: 'venture_origin_mission_declared',
      payload: {
        missionId,
      },
    });
  }

  return events.map(withDeterministicEventIds);
}

export function createVentureHistoryStore() {
  function append(
    history: { ventureId: string; entries: VentureHistoryEvent[] },
    inputEvent: Omit<VentureHistoryEvent, 'eventDedupeKey' | 'eventId'>,
  ): { ventureId: string; entries: VentureHistoryEvent[] } {
    const nextEvent = withDeterministicEventIds(inputEvent);
    const deduped = new Map<string, VentureHistoryEvent>();

    for (const entry of history.entries) {
      deduped.set(entry.eventDedupeKey, entry);
    }
    deduped.set(nextEvent.eventDedupeKey, nextEvent);

    return {
      ventureId: history.ventureId,
      entries: Array.from(deduped.values()).sort(compareEvents),
    };
  }

  function replay(input: {
    definition: VentureDefinition;
    status: VentureStatusProjection;
    events?: Array<Omit<VentureHistoryEvent, 'eventDedupeKey' | 'eventId'>>;
  }): { ventureId: string; entries: VentureHistoryEvent[] } {
    const seeded = createBaseEvents({
      definition: input.definition,
      status: input.status,
    });

    let history = {
      ventureId: input.definition.ventureId ?? '',
      entries: seeded,
    };

    for (const event of input.events ?? []) {
      history = append(history, event);
    }

    return {
      ventureId: history.ventureId,
      entries: history.entries.sort(compareEvents),
    };
  }

  return {
    append,
    replay,
  };
}

export type VentureHistoryStore = ReturnType<typeof createVentureHistoryStore>;
