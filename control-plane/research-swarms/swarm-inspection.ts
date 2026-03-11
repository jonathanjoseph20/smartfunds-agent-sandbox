import { createSwarmHistoryStore, type SwarmHistoryStore } from './swarm-history-store.ts';
import { createSwarmMaterializer, type SwarmMaterializer } from './swarm-materializer.ts';
import { createSwarmProjection, type SwarmProjectionEngine } from './swarm-projection.ts';
import { createSwarmRegistry, type SwarmRegistry } from './swarm-registry.ts';

export function createSwarmInspection(options: {
  registry?: SwarmRegistry;
  projection?: SwarmProjectionEngine;
  materializer?: SwarmMaterializer;
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
  const historyStore = options.historyStore ?? createSwarmHistoryStore({ artifactsRoot: options.swarmArtifactsRoot });
  const projection = options.projection ?? createSwarmProjection({
    registry,
    historyStore,
    definitionsDir: options.definitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    signalsRootDir: options.signalsRootDir,
    swarmArtifactsRoot: options.swarmArtifactsRoot
  });
  const materializer = options.materializer ?? createSwarmMaterializer({
    projection,
    swarmArtifactsRoot: options.swarmArtifactsRoot,
    definitionsDir: options.definitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    signalsRootDir: options.signalsRootDir
  });

  function listSwarms() {
    return registry.listSwarmDefinitions().map((entry) => ({
      swarmId: entry.swarmId,
      displayName: entry.displayName,
      teamId: entry.teamId,
      investigationTemplates: [...entry.investigationTemplates].sort((left, right) => left.localeCompare(right))
    }));
  }

  function inspectSwarm(swarmId: string) {
    return projection.projectOne(swarmId);
  }

  function getSwarmStatus(swarmId: string) {
    const projected = projection.projectOne(swarmId);
    return {
      swarmId,
      teamId: projected.teamId,
      state: projected.state,
      readiness: projected.readiness,
      completion: projected.completion
    };
  }

  function getSwarmInvestigations(swarmId: string) {
    const projected = projection.projectOne(swarmId);
    return {
      swarmId,
      investigations: projected.investigations
    };
  }

  function getSwarmReadiness(swarmId: string) {
    const projected = projection.projectOne(swarmId);
    return {
      swarmId,
      readiness: projected.readiness
    };
  }

  function getSwarmHistory(swarmId: string) {
    registry.getSwarmDefinition(swarmId);
    return historyStore.load(swarmId);
  }

  function evaluateSwarm(input: { swarmId: string; slotReference?: string }) {
    const projected = projection.projectOne(input.swarmId);

    if (projected.investigations.length > 0) {
      historyStore.append({
        swarmId: input.swarmId,
        eventType: 'investigation_linked',
        reason: 'investigations_grouped',
        linkedInvestigationIds: projected.investigations.map((entry) => entry.investigationRunId),
        linkedSynthesisIds: projected.syntheses.map((entry) => entry.synthesisId),
        state: projected.state,
        readiness: projected.readiness.readiness,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    if (projected.state !== 'inactive') {
      historyStore.append({
        swarmId: input.swarmId,
        eventType: 'swarm_activated',
        reason: 'swarm_state_non_inactive',
        linkedInvestigationIds: projected.investigations.map((entry) => entry.investigationRunId),
        linkedSynthesisIds: projected.syntheses.map((entry) => entry.synthesisId),
        state: projected.state,
        readiness: projected.readiness.readiness,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    if (projected.state === 'initializing' || projected.state === 'active' || projected.state === 'progressing') {
      historyStore.append({
        swarmId: input.swarmId,
        eventType: 'swarm_progressed',
        reason: `swarm_state_${projected.state}`,
        linkedInvestigationIds: projected.investigations.map((entry) => entry.investigationRunId),
        linkedSynthesisIds: projected.syntheses.map((entry) => entry.synthesisId),
        state: projected.state,
        readiness: projected.readiness.readiness,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    if (projected.state === 'stabilizing') {
      historyStore.append({
        swarmId: input.swarmId,
        eventType: 'swarm_stabilizing',
        reason: 'unresolved_conflicts_present',
        linkedInvestigationIds: projected.investigations.map((entry) => entry.investigationRunId),
        linkedSynthesisIds: projected.syntheses.map((entry) => entry.synthesisId),
        state: projected.state,
        readiness: projected.readiness.readiness,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    if (projected.state === 'completed') {
      historyStore.append({
        swarmId: input.swarmId,
        eventType: 'swarm_completed',
        reason: 'completion_rules_satisfied',
        linkedInvestigationIds: projected.investigations.map((entry) => entry.investigationRunId),
        linkedSynthesisIds: projected.syntheses.map((entry) => entry.synthesisId),
        state: projected.state,
        readiness: projected.readiness.readiness,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    return {
      projection: projected,
      history: historyStore.load(input.swarmId)
    };
  }

  function materializeSwarm(swarmId: string) {
    const projected = projection.projectOne(swarmId);
    return materializer.materializeProjection({ projection: projected });
  }

  return {
    listSwarms,
    inspectSwarm,
    getSwarmStatus,
    getSwarmInvestigations,
    getSwarmReadiness,
    getSwarmHistory,
    evaluateSwarm,
    materializeSwarm
  };
}

export type SwarmInspection = ReturnType<typeof createSwarmInspection>;
