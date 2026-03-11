import { createCrossSwarmLinker, type CrossSwarmLinkProjection, type CrossSwarmLinker } from './cross-swarm-linker.ts';
import { evaluateCrossSwarmCompletion } from './cross-swarm-completion.ts';
import { createCrossSwarmRegistry, type CrossSwarmRegistry } from './cross-swarm-registry.ts';
import type {
  CrossSwarmLifecycleState,
  CrossSwarmProjection,
  CrossSwarmReadinessState,
  CrossSwarmStatusProjection
} from './cross-swarm-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function evaluateLifecycleState(link: CrossSwarmLinkProjection): CrossSwarmLifecycleState {
  if (!link.enabled || link.linkedSwarms.length === 0) {
    return 'inactive';
  }

  const states = link.linkedSwarms.map((entry) => entry.lifecycleState);

  if (states.every((state) => state === 'inactive')) {
    return 'inactive';
  }
  if (states.every((state) => state === 'initializing' || state === 'inactive')) {
    return 'initializing';
  }
  if (states.every((state) => state === 'completed')) {
    return 'completed';
  }
  if (states.some((state) => state === 'stabilizing')) {
    return 'stabilizing';
  }
  if (states.some((state) => state === 'progressing')) {
    return 'progressing';
  }
  if (states.some((state) => state === 'active')) {
    return 'active';
  }

  return 'initializing';
}

function evaluateReadinessState(input: {
  link: CrossSwarmLinkProjection;
  blockers: string[];
  conflicts: string[];
}): CrossSwarmReadinessState {
  if (!input.link.enabled || input.link.linkedSwarms.length === 0) {
    return 'pending';
  }

  const states = input.link.linkedSwarms.map((entry) => entry.readinessState);
  if (input.blockers.length > 0 || input.conflicts.length > 0 || states.some((state) => state === 'blocked')) {
    return 'blocked';
  }
  if (states.every((state) => state === 'coherent') && states.length > 0) {
    return 'coherent';
  }
  if (states.some((state) => state === 'analyzing' || state === 'coherent')) {
    return 'analyzing';
  }

  return 'pending';
}

function toBlockers(link: CrossSwarmLinkProjection): string[] {
  const blockers: string[] = [];

  if (!link.enabled) {
    blockers.push('cross_swarm_disabled');
  }
  if (link.linkedSwarms.length === 0) {
    blockers.push('no_linked_swarms');
  }

  for (const swarm of link.linkedSwarms) {
    if (swarm.readinessState === 'blocked') {
      blockers.push(`blocked_swarm:${swarm.swarmId}`);
    }
    if (swarm.activeInvestigationCount > 0 && !swarm.completionSatisfied) {
      blockers.push(`incomplete_swarm:${swarm.swarmId}`);
    }
  }

  return uniqueSorted(blockers);
}

function toConflicts(link: CrossSwarmLinkProjection): string[] {
  return uniqueSorted(link.linkedSwarms
    .filter((swarm) => swarm.unresolvedConflictCount > 0)
    .map((swarm) => `swarm_conflicts:${swarm.swarmId}:${String(swarm.unresolvedConflictCount)}`));
}

function toStrengths(link: CrossSwarmLinkProjection): string[] {
  const strengths: string[] = [];
  if (link.linkedSwarms.length > 0) {
    strengths.push(`linked_swarms:${String(link.linkedSwarms.length)}`);
  }

  const coherentCount = link.linkedSwarms.filter((entry) => entry.readinessState === 'coherent').length;
  if (coherentCount > 0) {
    strengths.push(`coherent_swarms:${String(coherentCount)}`);
  }

  const completedCount = link.linkedSwarms.filter((entry) => entry.completionSatisfied).length;
  if (completedCount > 0) {
    strengths.push(`completed_swarms:${String(completedCount)}`);
  }

  return uniqueSorted(strengths);
}

function toLimitations(input: {
  blockers: string[];
  conflicts: string[];
  link: CrossSwarmLinkProjection;
  completionUnmet: string[];
}): string[] {
  const limitations = [
    ...input.blockers,
    ...input.conflicts,
    ...input.completionUnmet
  ];

  if (input.link.linkedSwarms.some((entry) => entry.activeInvestigationCount > 0)) {
    limitations.push('active_investigations_present');
  }

  return uniqueSorted(limitations);
}

export function createCrossSwarmStatusProjection(options: {
  registry?: CrossSwarmRegistry;
  linker?: CrossSwarmLinker;
  definitionsDir?: string;
  swarmDefinitionsDir?: string;
  teamDefinitionsDir?: string;
  cohortDefinitionsDir?: string;
  cohortProgramDefinitionsDir?: string;
  cohortArtifactsRoot?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  policyDefinitionsDir?: string;
  coordinationArtifactsRoot?: string;
  teamSwarmArtifactsRoot?: string;
  swarmArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const registry = options.registry ?? createCrossSwarmRegistry({ definitionsDir: options.definitionsDir });
  const linker = options.linker ?? createCrossSwarmLinker({
    registry,
    definitionsDir: options.definitionsDir,
    swarmDefinitionsDir: options.swarmDefinitionsDir,
    teamDefinitionsDir: options.teamDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    policyDefinitionsDir: options.policyDefinitionsDir,
    coordinationArtifactsRoot: options.coordinationArtifactsRoot,
    teamSwarmArtifactsRoot: options.teamSwarmArtifactsRoot,
    swarmArtifactsRoot: options.swarmArtifactsRoot,
    now: options.now
  });

  function projectOne(crossSwarmId: string): CrossSwarmStatusProjection {
    const definition = registry.getDefinition(crossSwarmId);
    const link = linker.buildLinks().find((entry) => entry.crossSwarmId === crossSwarmId);
    if (!link) {
      throw new Error(`CROSS_SWARM_NOT_FOUND: ${crossSwarmId}`);
    }

    const blockers = toBlockers(link);
    const conflicts = toConflicts(link);
    const readinessState = evaluateReadinessState({ link, blockers, conflicts });
    const lifecycleState = evaluateLifecycleState(link);
    const completion = evaluateCrossSwarmCompletion({
      definition,
      linkedSwarms: link.linkedSwarms,
      readinessState
    });

    const strengths = toStrengths(link);
    const limitations = toLimitations({
      blockers,
      conflicts,
      link,
      completionUnmet: completion.unmetRequirements
    });

    return {
      crossSwarmId,
      displayName: definition.displayName,
      groupType: definition.groupType,
      enabled: definition.enabled,
      linkedSwarmIds: link.linkedSwarmIds,
      linkedSwarms: link.linkedSwarms,
      lifecycleState,
      readinessState,
      completion,
      blockers,
      conflicts,
      strengths,
      limitations,
      rationale: link.rationale
    };
  }

  function projectAll(): CrossSwarmStatusProjection[] {
    return registry.listDefinitions()
      .map((definition) => projectOne(definition.crossSwarmId))
      .sort((left, right) => left.crossSwarmId.localeCompare(right.crossSwarmId));
  }

  return {
    projectOne,
    projectAll
  };
}

export type CrossSwarmStatusProjectionEngine = ReturnType<typeof createCrossSwarmStatusProjection>;
