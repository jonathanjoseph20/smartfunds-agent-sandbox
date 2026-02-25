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
    expect(result.railEnforcementErrors).toEqual([]);
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
    expect(result.railEnforcementErrors).toEqual([
      'Rail enforcement: incompatible rail profiles detected (structured-only vs autonomous-only). Entities: a-entity:structured-only, b-entity:autonomous-only.'
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
    expect(result.railEnforcementErrors).toEqual([]);
  });

  it('blocks restricted mixing with hybrid', () => {
    const result = buildRailBindingDiagnostics(
      ['restricted-entity', 'hybrid-entity'],
      registry([
        { entityId: 'restricted-entity', railProfile: 'restricted' },
        { entityId: 'hybrid-entity', railProfile: 'hybrid' }
      ])
    );

    expect(result.railBindingStatus).toBe('multi_entity_mixed_profiles');
    expect(result.railEnforcementErrors).toEqual([
      'Rail enforcement: restricted rail profile cannot mix with hybrid. Entities: hybrid-entity:hybrid, restricted-entity:restricted.'
    ]);
  });

  it('blocks restricted mixing with autonomous-only', () => {
    const result = buildRailBindingDiagnostics(
      ['restricted-entity', 'autonomous-entity'],
      registry([
        { entityId: 'restricted-entity', railProfile: 'restricted' },
        { entityId: 'autonomous-entity', railProfile: 'autonomous-only' }
      ])
    );

    expect(result.railBindingStatus).toBe('multi_entity_mixed_profiles');
    expect(result.railEnforcementErrors).toEqual([
      'Rail enforcement: restricted rail profile cannot mix with autonomous-only. Entities: autonomous-entity:autonomous-only, restricted-entity:restricted.'
    ]);
  });

  it('allows restricted to coexist with structured-only', () => {
    const result = buildRailBindingDiagnostics(
      ['restricted-entity', 'structured-entity'],
      registry([
        { entityId: 'restricted-entity', railProfile: 'restricted' },
        { entityId: 'structured-entity', railProfile: 'structured-only' }
      ])
    );

    expect(result.railBindingStatus).toBe('ok');
    expect(result.railEnforcementErrors).toEqual([]);
  });

  it('allows autonomous-only to coexist with hybrid', () => {
    const result = buildRailBindingDiagnostics(
      ['autonomous-entity', 'hybrid-entity'],
      registry([
        { entityId: 'hybrid-entity', railProfile: 'hybrid' },
        { entityId: 'autonomous-entity', railProfile: 'autonomous-only' }
      ])
    );

    expect(result.railBindingStatus).toBe('ok');
    expect(result.railEnforcementErrors).toEqual([]);
  });

  it('allows structured-only to coexist with hybrid', () => {
    const result = buildRailBindingDiagnostics(
      ['structured-entity', 'hybrid-entity'],
      registry([
        { entityId: 'hybrid-entity', railProfile: 'hybrid' },
        { entityId: 'structured-entity', railProfile: 'structured-only' }
      ])
    );

    expect(result.railBindingStatus).toBe('ok');
    expect(result.railEnforcementErrors).toEqual([]);
  });

  it('does not enforce when an entity is missing a rail profile', () => {
    const result = buildRailBindingDiagnostics(
      ['structured-entity', 'missing-entity'],
      registry([{ entityId: 'structured-entity', railProfile: 'structured-only' }])
    );

    expect(result.entitiesMissingRailProfile).toEqual(['missing-entity']);
    expect(result.railEnforcementErrors).toEqual([]);
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
    expect(result.railEnforcementErrors).toEqual([
      'Rail enforcement: incompatible rail profiles detected (structured-only vs autonomous-only). Entities: autonomous-entity:autonomous-only, structured-entity:structured-only.'
    ]);
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

  it('keeps enforcement output deterministic under input ordering', () => {
    const first = buildRailBindingDiagnostics(
      ['b-entity', 'a-entity', 'c-entity'],
      registry([
        { entityId: 'a-entity', railProfile: 'structured-only' },
        { entityId: 'b-entity', railProfile: 'autonomous-only' },
        { entityId: 'c-entity', railProfile: 'hybrid' }
      ])
    );

    const second = buildRailBindingDiagnostics(
      ['c-entity', 'b-entity', 'a-entity'],
      registry([
        { entityId: 'c-entity', railProfile: 'hybrid' },
        { entityId: 'b-entity', railProfile: 'autonomous-only' },
        { entityId: 'a-entity', railProfile: 'structured-only' }
      ])
    );

    expect(first.railEnforcementErrors).toEqual(second.railEnforcementErrors);
    expect(first.entityRailProfileByEntity).toEqual(second.entityRailProfileByEntity);
    expect(first.railViolations).toEqual(second.railViolations);
  });
});
