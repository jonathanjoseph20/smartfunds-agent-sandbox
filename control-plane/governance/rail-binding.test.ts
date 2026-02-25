import { describe, expect, it } from 'vitest';

import type { RailRegistry } from '../entities/rails.ts';
import { buildRailBindingDiagnostics } from './rail-binding.ts';

function registry(entries: RailRegistry['entities']): RailRegistry {
  return {
    version: 1,
    entities: [...entries].sort((a, b) => a.entityId.localeCompare(b.entityId)),
    railProfileByEntity: new Map(entries.map((entry) => [entry.entityId, entry.railProfile]))
  };
}

describe('rail binding diagnostics', () => {
  it('detects missing rail profiles deterministically', () => {
    const result = buildRailBindingDiagnostics(
      ['beta-entity', 'alpha-entity'],
      registry([{ entityId: 'alpha-entity', railProfile: 'hybrid' }])
    );

    expect(result.entityRailProfileByEntity).toEqual({
      'alpha-entity': 'hybrid',
      'beta-entity': null
    });
    expect(result.entitiesMissingRailProfile).toEqual(['beta-entity']);
    expect(result.railBindingStatus).toBe('missing_rail_profile');
    expect(result.railViolations).toEqual([
      {
        type: 'ENTITY_MISSING_RAIL_PROFILE',
        entityId: 'beta-entity',
        details: 'Entity beta-entity is missing a rail profile mapping in control-plane/entities/rails.json.'
      }
    ]);
  });

  it('detects mixed incompatible profiles deterministically', () => {
    const result = buildRailBindingDiagnostics(
      ['b-entity', 'a-entity'],
      registry([
        { entityId: 'a-entity', railProfile: 'structured-only' },
        { entityId: 'b-entity', railProfile: 'autonomous-only' }
      ])
    );

    expect(result.entitiesMissingRailProfile).toEqual([]);
    expect(result.railBindingStatus).toBe('multi_entity_mixed_profiles');
    expect(result.railViolations).toEqual([
      {
        type: 'MIXED_INCOMPATIBLE_RAIL_PROFILES',
        details: 'Incompatible rail profiles across touched entities: a-entity:structured-only, b-entity:autonomous-only.'
      }
    ]);
  });

  it('allows hybrid to coexist without mixed-profile violation', () => {
    const result = buildRailBindingDiagnostics(
      ['autonomous-entity', 'hybrid-entity'],
      registry([
        { entityId: 'hybrid-entity', railProfile: 'hybrid' },
        { entityId: 'autonomous-entity', railProfile: 'autonomous-only' }
      ])
    );

    expect(result.railBindingStatus).toBe('ok');
    expect(result.railViolations).toEqual([]);
  });

  it('applies status precedence when missing and mixed issues both occur', () => {
    const result = buildRailBindingDiagnostics(
      ['missing-entity', 'structured-entity', 'autonomous-entity'],
      registry([
        { entityId: 'structured-entity', railProfile: 'structured-only' },
        { entityId: 'autonomous-entity', railProfile: 'autonomous-only' }
      ])
    );

    expect(result.entitiesMissingRailProfile).toEqual(['missing-entity']);
    expect(result.railBindingStatus).toBe('multi_entity_mixed_profiles');
  });

  it('sorts violations stably by type, entityId, details', () => {
    const result = buildRailBindingDiagnostics(
      ['missing-b', 'structured', 'autonomous', 'missing-a'],
      registry([
        { entityId: 'structured', railProfile: 'structured-only' },
        { entityId: 'autonomous', railProfile: 'autonomous-only' }
      ])
    );

    expect(result.railViolations.map((violation) => `${violation.type}:${violation.entityId ?? ''}`)).toEqual([
      'ENTITY_MISSING_RAIL_PROFILE:missing-a',
      'ENTITY_MISSING_RAIL_PROFILE:missing-b',
      'MIXED_INCOMPATIBLE_RAIL_PROFILES:'
    ]);
  });
});
