import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  TeamDefinition,
  TeamHistoryEvent,
  TeamHistoryEventType,
} from './team-definition-types.ts';

function compareEvents(left: TeamHistoryEvent, right: TeamHistoryEvent): number {
  const sequenceCmp = left.sequence - right.sequence;
  if (sequenceCmp !== 0) {
    return sequenceCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

export function computeTeamHistoryEventDedupeKey(input: {
  teamId: string;
  eventType: TeamHistoryEventType;
  payload: Record<string, unknown>;
  reasoning: string;
  sequence: number;
}): string {
  return sha256(canonicalStringify({
    teamId: input.teamId,
    eventType: input.eventType,
    payload: input.payload,
    reasoning: input.reasoning,
    sequence: input.sequence,
  }));
}

function createBaseEvents(definition: TeamDefinition): TeamHistoryEvent[] {
  const events: Array<Omit<TeamHistoryEvent, 'eventDedupeKey'>> = [
    {
      teamId: definition.teamId,
      eventType: 'team_defined',
      sequence: 1,
      reasoning: 'team_definition_loaded',
      payload: {
        lifecycleState: definition.lifecycleState,
        availabilityState: definition.availabilityState,
        readinessState: definition.readinessState,
      },
    },
  ];

  if (definition.lifecycleState === 'active') {
    events.push({
      teamId: definition.teamId,
      eventType: 'team_activated',
      sequence: 2,
      reasoning: 'team_lifecycle_active',
      payload: {
        lifecycleState: definition.lifecycleState,
      },
    });
  }

  if (definition.lifecycleState === 'dormant') {
    events.push({
      teamId: definition.teamId,
      eventType: 'team_marked_dormant',
      sequence: 2,
      reasoning: 'team_lifecycle_dormant',
      payload: {
        lifecycleState: definition.lifecycleState,
      },
    });
  }

  if (definition.lifecycleState === 'archived') {
    events.push({
      teamId: definition.teamId,
      eventType: 'team_archived',
      sequence: 2,
      reasoning: 'team_lifecycle_archived',
      payload: {
        lifecycleState: definition.lifecycleState,
      },
    });
  }

  events.push({
    teamId: definition.teamId,
    eventType: 'team_availability_changed',
    sequence: 3,
    reasoning: 'team_availability_declared',
    payload: {
      availabilityState: definition.availabilityState,
    },
  });

  events.push({
    teamId: definition.teamId,
    eventType: 'team_capability_updated',
    sequence: 4,
    reasoning: 'team_capabilities_declared',
    payload: {
      capabilityTags: [...definition.capabilityTags].sort((left, right) => left.localeCompare(right)),
    },
  });

  return events.map((event) => ({
    ...event,
    eventDedupeKey: computeTeamHistoryEventDedupeKey(event),
  }));
}

export function createTeamHistoryStore() {
  function load(teamDefinition: TeamDefinition): { teamId: string; entries: TeamHistoryEvent[] } {
    const seeded = createBaseEvents(teamDefinition)
      .sort(compareEvents);

    const dedupedByKey = new Map<string, TeamHistoryEvent>();
    for (const event of seeded) {
      dedupedByKey.set(event.eventDedupeKey, event);
    }

    return {
      teamId: teamDefinition.teamId,
      entries: Array.from(dedupedByKey.values()).sort(compareEvents),
    };
  }

  return {
    load,
  };
}

export type TeamHistoryStore = ReturnType<typeof createTeamHistoryStore>;
