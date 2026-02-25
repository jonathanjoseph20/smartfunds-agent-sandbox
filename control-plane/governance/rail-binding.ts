import { getRailProfile, loadRailsRegistry, type RailProfile, type RailRegistry } from '../entities/rails.ts';

export type RailBindingStatus = 'ok' | 'missing_rail_profile' | 'multi_entity_mixed_profiles' | 'unknown';

export type RailViolationType = 'ENTITY_MISSING_RAIL_PROFILE' | 'MIXED_INCOMPATIBLE_RAIL_PROFILES';

export type RailViolation = {
  type: RailViolationType;
  entityId?: string;
  details: string;
};

export type RailBindingDiagnostics = {
  entityRailProfileByEntity: Record<string, RailProfile | null>;
  entitiesMissingRailProfile: string[];
  railBindingStatus: RailBindingStatus;
  railViolations: RailViolation[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function sortViolations(values: RailViolation[]): RailViolation[] {
  return [...values].sort((a, b) => {
    const typeCompare = a.type.localeCompare(b.type);
    if (typeCompare !== 0) {
      return typeCompare;
    }

    if (a.entityId && b.entityId) {
      const entityCompare = a.entityId.localeCompare(b.entityId);
      if (entityCompare !== 0) {
        return entityCompare;
      }
    } else if (a.entityId && !b.entityId) {
      return -1;
    } else if (!a.entityId && b.entityId) {
      return 1;
    }

    return a.details.localeCompare(b.details);
  });
}

function areProfilesCompatible(left: RailProfile, right: RailProfile): boolean {
  if (left === right) {
    return true;
  }

  if (left === 'hybrid' || right === 'hybrid') {
    return left !== 'restricted' && right !== 'restricted';
  }

  if (left === 'restricted' || right === 'restricted') {
    return false;
  }

  if ((left === 'structured-only' && right === 'autonomous-only') ||
      (left === 'autonomous-only' && right === 'structured-only')) {
    return false;
  }

  return true;
}

export function buildRailBindingDiagnostics(
  entitiesTouched: string[],
  registry: RailRegistry
): RailBindingDiagnostics {
  const orderedEntities = sortedUnique(entitiesTouched);
  const entityRailProfileByEntity: Record<string, RailProfile | null> = {};
  const entitiesMissingRailProfile: string[] = [];
  const knownProfiles: Array<{ entityId: string; railProfile: RailProfile }> = [];
  const railViolations: RailViolation[] = [];

  for (const entityId of orderedEntities) {
    const railProfile = getRailProfile(entityId, registry);
    entityRailProfileByEntity[entityId] = railProfile;
    if (railProfile === null) {
      entitiesMissingRailProfile.push(entityId);
      railViolations.push({
        type: 'ENTITY_MISSING_RAIL_PROFILE',
        entityId,
        details: `Entity ${entityId} is missing a rail profile mapping in control-plane/entities/rails.json.`
      });
      continue;
    }

    knownProfiles.push({ entityId, railProfile });
  }

  let hasIncompatibleMix = false;
  for (let i = 0; i < knownProfiles.length; i += 1) {
    for (let j = i + 1; j < knownProfiles.length; j += 1) {
      const left = knownProfiles[i];
      const right = knownProfiles[j];
      if (!areProfilesCompatible(left.railProfile, right.railProfile)) {
        hasIncompatibleMix = true;
      }
    }
  }

  if (hasIncompatibleMix) {
    const profileSummary = knownProfiles
      .map((entry) => `${entry.entityId}:${entry.railProfile}`)
      .sort((a, b) => a.localeCompare(b))
      .join(', ');
    railViolations.push({
      type: 'MIXED_INCOMPATIBLE_RAIL_PROFILES',
      details: `Incompatible rail profiles across touched entities: ${profileSummary}.`
    });
  }

  let railBindingStatus: RailBindingStatus = 'ok';
  if (hasIncompatibleMix) {
    railBindingStatus = 'multi_entity_mixed_profiles';
  } else if (entitiesMissingRailProfile.length > 0) {
    railBindingStatus = 'missing_rail_profile';
  }

  return {
    entityRailProfileByEntity,
    entitiesMissingRailProfile,
    railBindingStatus,
    railViolations: sortViolations(railViolations)
  };
}

export function buildFallbackRailBindingDiagnostics(entitiesTouched: string[]): RailBindingDiagnostics {
  const orderedEntities = sortedUnique(entitiesTouched);
  const entityRailProfileByEntity: Record<string, RailProfile | null> = {};
  for (const entityId of orderedEntities) {
    entityRailProfileByEntity[entityId] = null;
  }

  return {
    entityRailProfileByEntity,
    entitiesMissingRailProfile: orderedEntities,
    railBindingStatus: orderedEntities.length > 0 ? 'unknown' : 'ok',
    railViolations: []
  };
}

export function resolveRailBindingDiagnostics(
  entitiesTouched: string[],
  options: { registryPath?: string } = {}
): { diagnostics: RailBindingDiagnostics; warnings: string[]; nextActions: string[] } {
  const warnings: string[] = [];
  const nextActions: string[] = [];
  let diagnostics: RailBindingDiagnostics;

  try {
    const registry = loadRailsRegistry(options);
    diagnostics = buildRailBindingDiagnostics(entitiesTouched, registry);
  } catch (error) {
    warnings.push(`Rails registry error: ${(error as Error).message}`);
    nextActions.push('Review control-plane/entities/rails.json for schema or mapping errors.');
    diagnostics = buildFallbackRailBindingDiagnostics(entitiesTouched);
  }

  if (diagnostics.entitiesMissingRailProfile.length > 0) {
    nextActions.push('Add missing entityId railProfile mappings to control-plane/entities/rails.json.');
  }

  if (diagnostics.railBindingStatus === 'multi_entity_mixed_profiles') {
    nextActions.push('Rail profile mix is incompatible across entities; no enforcement yet (diagnostic only).');
  }

  return { diagnostics, warnings, nextActions };
}
