import {
  createTeamSwarmHistoryStore,
  type TeamSwarmHistoryStore
} from './team-swarm-history-store.ts';
import {
  createTeamSwarmMaterializer,
  type TeamSwarmMaterializer
} from './team-swarm-materializer.ts';
import {
  createTeamSwarmProjection,
  type TeamSwarmProjectionEngine
} from './team-swarm-projection.ts';
import {
  createTeamSwarmRegistry,
  type TeamSwarmRegistry
} from './team-swarm-registry.ts';
import type { TeamSwarmStatusRecord } from './team-swarm-types.ts';

function toProgressEventReason(record: TeamSwarmStatusRecord): string {
  if (record.lifecycle === 'progressing') {
    return 'swarm_lifecycle_progressing';
  }
  return 'swarm_state_activated';
}

function toStabilizingReason(record: TeamSwarmStatusRecord): string {
  if (record.completion.unresolvedConflictCount > 0) {
    return `unresolved_conflicts:${String(record.completion.unresolvedConflictCount)}`;
  }
  return 'swarm_stabilization_in_progress';
}

export function createTeamSwarmInspection(options: {
  registry?: TeamSwarmRegistry;
  projection?: TeamSwarmProjectionEngine;
  materializer?: TeamSwarmMaterializer;
  historyStore?: TeamSwarmHistoryStore;
  teamDefinitionsDir?: string;
  swarmDefinitionsDir?: string;
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
  swarmArtifactsRoot?: string;
  teamSwarmArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const registry = options.registry ?? createTeamSwarmRegistry({
    teamDefinitionsDir: options.teamDefinitionsDir,
    swarmDefinitionsDir: options.swarmDefinitionsDir
  });
  const historyStore = options.historyStore ?? createTeamSwarmHistoryStore({
    artifactsRoot: options.teamSwarmArtifactsRoot
  });
  const projection = options.projection ?? createTeamSwarmProjection({
    registry,
    historyStore,
    teamDefinitionsDir: options.teamDefinitionsDir,
    swarmDefinitionsDir: options.swarmDefinitionsDir,
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
    swarmArtifactsRoot: options.swarmArtifactsRoot,
    teamSwarmArtifactsRoot: options.teamSwarmArtifactsRoot,
    now: options.now
  });
  const materializer = options.materializer ?? createTeamSwarmMaterializer({
    projection,
    teamSwarmArtifactsRoot: options.teamSwarmArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    swarmDefinitionsDir: options.swarmDefinitionsDir,
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
    swarmArtifactsRoot: options.swarmArtifactsRoot,
    now: options.now
  });

  function listTeams() {
    return registry.listTeamsWithSwarms();
  }

  function inspectTeam(teamId: string) {
    return projection.projectOne(teamId);
  }

  function getTeamStatus(teamId: string) {
    const projected = projection.projectOne(teamId);
    return {
      teamId,
      topicProgress: projected.topicProgress,
      swarms: projected.linkedSwarms.map((entry) => ({
        swarmId: entry.swarmId,
        lifecycle: entry.lifecycle,
        readiness: entry.readiness,
        completion: entry.completion
      }))
    };
  }

  function getTeamPriorities(teamId: string) {
    const projected = projection.projectOne(teamId);
    return {
      teamId,
      priorities: projected.linkedSwarms
        .map((entry) => ({
          swarmId: entry.swarmId,
          priority: entry.priority.priority,
          reasons: entry.priority.reasons,
          appliedRule: entry.priority.appliedRule
        }))
        .sort((left, right) => left.swarmId.localeCompare(right.swarmId))
    };
  }

  function getTeamHistory(teamId: string) {
    registry.listByTeam(teamId);
    return historyStore.load(teamId);
  }

  function evaluateTeam(input: { teamId: string; slotReference?: string }) {
    const projected = projection.projectOne(input.teamId);

    for (const swarm of projected.linkedSwarms) {
      if (swarm.activation.activated) {
        historyStore.append({
          teamId: input.teamId,
          swarmId: swarm.swarmId,
          eventType: 'swarm_activated',
          reason: swarm.activation.reasons.join('|') || 'swarm_activation_conditions_satisfied',
          priority: swarm.priority.priority,
          lifecycle: swarm.lifecycle,
          readiness: swarm.readiness.readiness,
          linkedInvestigationIds: swarm.linkedInvestigationIds,
          linkedSynthesisIds: swarm.linkedSynthesisIds,
          ...(input.slotReference ? { slotReference: input.slotReference } : {})
        });
      }

      historyStore.append({
        teamId: input.teamId,
        swarmId: swarm.swarmId,
        eventType: 'swarm_prioritized',
        reason: swarm.priority.reasons.join('|') || 'priority_evaluated',
        priority: swarm.priority.priority,
        lifecycle: swarm.lifecycle,
        readiness: swarm.readiness.readiness,
        linkedInvestigationIds: swarm.linkedInvestigationIds,
        linkedSynthesisIds: swarm.linkedSynthesisIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });

      if (swarm.lifecycle === 'activated' || swarm.lifecycle === 'progressing') {
        historyStore.append({
          teamId: input.teamId,
          swarmId: swarm.swarmId,
          eventType: 'swarm_progressed',
          reason: toProgressEventReason(swarm),
          priority: swarm.priority.priority,
          lifecycle: swarm.lifecycle,
          readiness: swarm.readiness.readiness,
          linkedInvestigationIds: swarm.linkedInvestigationIds,
          linkedSynthesisIds: swarm.linkedSynthesisIds,
          ...(input.slotReference ? { slotReference: input.slotReference } : {})
        });
      }

      if (swarm.lifecycle === 'stabilizing') {
        historyStore.append({
          teamId: input.teamId,
          swarmId: swarm.swarmId,
          eventType: 'swarm_stabilizing',
          reason: toStabilizingReason(swarm),
          priority: swarm.priority.priority,
          lifecycle: swarm.lifecycle,
          readiness: swarm.readiness.readiness,
          linkedInvestigationIds: swarm.linkedInvestigationIds,
          linkedSynthesisIds: swarm.linkedSynthesisIds,
          ...(input.slotReference ? { slotReference: input.slotReference } : {})
        });
      }

      if (swarm.lifecycle === 'completed') {
        historyStore.append({
          teamId: input.teamId,
          swarmId: swarm.swarmId,
          eventType: 'swarm_completed',
          reason: 'swarm_completion_requirements_satisfied',
          priority: swarm.priority.priority,
          lifecycle: swarm.lifecycle,
          readiness: swarm.readiness.readiness,
          linkedInvestigationIds: swarm.linkedInvestigationIds,
          linkedSynthesisIds: swarm.linkedSynthesisIds,
          ...(input.slotReference ? { slotReference: input.slotReference } : {})
        });
      }
    }

    return {
      projection: projected,
      history: historyStore.load(input.teamId)
    };
  }

  function materializeTeam(teamId: string) {
    const projected = projection.projectOne(teamId);
    return materializer.materializeProjection({ projection: projected });
  }

  return {
    listTeams,
    inspectTeam,
    getTeamStatus,
    getTeamPriorities,
    getTeamHistory,
    evaluateTeam,
    materializeTeam
  };
}

export type TeamSwarmInspection = ReturnType<typeof createTeamSwarmInspection>;
