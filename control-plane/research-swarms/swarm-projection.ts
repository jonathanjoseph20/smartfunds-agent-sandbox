import { createInvestigationInspection, type InvestigationInspection } from '../investigations/investigation-inspection.ts';
import { createSynthesisInspection, type SynthesisInspection } from '../synthesis/synthesis-inspection.ts';

import { evaluateCompletionRules } from './swarm-completion.ts';
import { createSwarmHistoryStore, type SwarmHistoryStore } from './swarm-history-store.ts';
import {
  createSwarmInvestigationRouting,
  type SwarmInvestigationRouting,
  type SwarmRoutableInvestigation
} from './swarm-investigation-routing.ts';
import { evaluateSwarmReadiness } from './swarm-readiness.ts';
import { createSwarmRegistry, type SwarmRegistry } from './swarm-registry.ts';
import { evaluateSwarmState } from './swarm-state.ts';
import type { SwarmProjection } from './swarm-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function toRoutableInvestigations(records: Array<{ investigationRunId: string; investigationDefinitionId: string; status: string }>): SwarmRoutableInvestigation[] {
  return records
    .map((record) => ({
      investigationRunId: record.investigationRunId,
      investigationDefinitionId: record.investigationDefinitionId,
      status: record.status
    }))
    .sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));
}

function mapSyntheses(
  synthesisInspection: SynthesisInspection,
  linkedInvestigationIds: string[]
): Array<{ synthesisId: string; readinessState: string; unresolvedConflictCount: number }> {
  const sets = synthesisInspection.listSynthesisSets();

  return sets
    .map((set) => {
      const links = synthesisInspection.inspectLinks(set.synthesisId);
      const linkedIds = uniqueSorted(links.linkedInvestigationIds ?? []);
      const intersects = linkedIds.some((investigationRunId) => linkedInvestigationIds.includes(investigationRunId));
      if (!intersects) {
        return null;
      }

      const status = synthesisInspection.inspectStatus(set.synthesisId);
      const conflicts = synthesisInspection.inspectConflicts(set.synthesisId);

      return {
        synthesisId: set.synthesisId,
        readinessState: status.readinessState,
        unresolvedConflictCount: conflicts.conflicts.length
      };
    })
    .filter((entry): entry is { synthesisId: string; readinessState: string; unresolvedConflictCount: number } => entry !== null)
    .sort((left, right) => left.synthesisId.localeCompare(right.synthesisId));
}

export function createSwarmProjection(options: {
  registry?: SwarmRegistry;
  routing?: SwarmInvestigationRouting;
  investigationInspection?: InvestigationInspection;
  synthesisInspection?: SynthesisInspection;
  historyStore?: SwarmHistoryStore;
  definitionsDir?: string;
  investigationDefinitionsDir?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  signalsRootDir?: string;
  swarmArtifactsRoot?: string;
} = {}) {
  const registry = options.registry ?? createSwarmRegistry({ definitionsDir: options.definitionsDir });
  const routing = options.routing ?? createSwarmInvestigationRouting({
    registry,
    definitionsDir: options.definitionsDir
  });
  const investigationInspection = options.investigationInspection ?? createInvestigationInspection({
    definitionsDir: options.investigationDefinitionsDir,
    rootDir: options.investigationsRootDir,
    artifactsRoot: options.investigationArtifactsRoot
  });
  const synthesisInspection = options.synthesisInspection ?? createSynthesisInspection({
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });
  const historyStore = options.historyStore ?? createSwarmHistoryStore({
    artifactsRoot: options.swarmArtifactsRoot
  });

  function projectOne(swarmId: string): SwarmProjection {
    const definition = registry.getSwarmDefinition(swarmId);
    const allInvestigations = toRoutableInvestigations(investigationInspection.listInvestigations());
    const linkedInvestigations = routing.getSwarmInvestigations(swarmId, allInvestigations);

    const linkedInvestigationIds = linkedInvestigations
      .map((entry) => entry.investigationRunId)
      .sort((left, right) => left.localeCompare(right));

    const syntheses = mapSyntheses(synthesisInspection, linkedInvestigationIds);
    const unresolvedConflictCount = syntheses.reduce((total, entry) => total + entry.unresolvedConflictCount, 0);

    const readiness = evaluateSwarmReadiness({
      swarmId,
      expectedInvestigationTemplates: definition.investigationTemplates,
      investigations: linkedInvestigations,
      synthesisReadinessStates: syntheses.map((entry) => entry.readinessState),
      unresolvedConflictCount
    });

    const completion = evaluateCompletionRules({
      swarmId,
      completionRules: definition.completionRules,
      investigations: linkedInvestigations,
      unresolvedConflictCount
    });

    const state = evaluateSwarmState({
      investigations: linkedInvestigations,
      syntheses,
      completionSatisfied: completion.isComplete
    });

    const history = historyStore.load(swarmId);
    const linkedSynthesisIds = syntheses.map((entry) => entry.synthesisId).sort((left, right) => left.localeCompare(right));

    const statusPreview = {
      swarmId,
      teamId: definition.teamId,
      state,
      readiness,
      completion,
      linkedInvestigationIds,
      linkedSynthesisIds
    } as Record<string, unknown>;

    const reportPreview = {
      swarmId,
      displayName: definition.displayName,
      teamId: definition.teamId,
      investigationTemplates: [...definition.investigationTemplates].sort((left, right) => left.localeCompare(right)),
      completionRules: definition.completionRules,
      investigations: linkedInvestigations,
      syntheses,
      state,
      readiness,
      completion,
      history
    } as Record<string, unknown>;

    return {
      swarmId,
      teamId: definition.teamId,
      investigations: linkedInvestigations,
      syntheses,
      state,
      readiness,
      completion,
      historySummary: {
        totalEvents: history.entries.length,
        ...(history.entries[0] ? { lastEventType: history.entries[0].eventType } : {}),
        ...(history.entries[0] ? { lastEventDedupeKey: history.entries[0].eventDedupeKey } : {})
      },
      statusPreview,
      reportPreview
    };
  }

  function projectAll(): SwarmProjection[] {
    return registry
      .listSwarmDefinitions()
      .map((definition) => projectOne(definition.swarmId))
      .sort((left, right) => left.swarmId.localeCompare(right.swarmId));
  }

  return {
    projectOne,
    projectAll
  };
}

export type SwarmProjectionEngine = ReturnType<typeof createSwarmProjection>;
