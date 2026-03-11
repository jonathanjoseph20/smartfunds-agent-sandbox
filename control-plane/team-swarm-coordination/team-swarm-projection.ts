import { createCohortInspection, type CohortInspection } from '../cohorts/cohort-inspection.ts';
import { createInvestigationInspection, type InvestigationInspection } from '../investigations/investigation-inspection.ts';
import { createSwarmInspection, type SwarmInspection } from '../research-swarms/swarm-inspection.ts';
import { createResearchTeamInspection, type ResearchTeamInspection } from '../research-teams/research-team-inspection.ts';

import { evaluateTeamSwarmActivation } from './team-swarm-activation.ts';
import { evaluateTeamTopicProgress, evaluateTeamSwarmCompletion } from './team-swarm-completion.ts';
import {
  createTeamSwarmHistoryStore,
  resolveTeamSwarmArtifactPaths,
  type TeamSwarmHistoryStore
} from './team-swarm-history-store.ts';
import { evaluateTeamSwarmPriority } from './team-swarm-priority.ts';
import { evaluateTeamSwarmReadiness } from './team-swarm-readiness.ts';
import { createTeamSwarmRegistry, type TeamSwarmRegistry } from './team-swarm-registry.ts';
import { evaluateTeamSwarmState } from './team-swarm-state.ts';
import type { TeamSwarmProjection, TeamSwarmStatusRecord } from './team-swarm-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isFailureHealthState(value: string): boolean {
  return value === 'degraded' || value === 'unhealthy' || value === 'inconclusive';
}

function toReasons(input: {
  activationReasons: string[];
  priorityReasons: string[];
  readinessReasons: string[];
  completionUnmet: string[];
}): string[] {
  return uniqueSorted([
    ...input.activationReasons,
    ...input.priorityReasons,
    ...input.readinessReasons,
    ...input.completionUnmet
  ]);
}

export function createTeamSwarmProjection(options: {
  registry?: TeamSwarmRegistry;
  teamInspection?: ResearchTeamInspection;
  swarmInspection?: SwarmInspection;
  cohortInspection?: CohortInspection;
  investigationInspection?: InvestigationInspection;
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
  const teamInspection = options.teamInspection ?? createResearchTeamInspection({
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
    now: options.now
  });
  const swarmInspection = options.swarmInspection ?? createSwarmInspection({
    definitionsDir: options.swarmDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    signalsRootDir: options.signalsRootDir,
    swarmArtifactsRoot: options.swarmArtifactsRoot
  });
  const cohortInspection = options.cohortInspection ?? createCohortInspection({
    definitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    now: options.now
  });
  const investigationInspection = options.investigationInspection ?? createInvestigationInspection({
    definitionsDir: options.investigationDefinitionsDir,
    rootDir: options.investigationsRootDir,
    artifactsRoot: options.investigationArtifactsRoot
  });
  const historyStore = options.historyStore ?? createTeamSwarmHistoryStore({
    artifactsRoot: options.teamSwarmArtifactsRoot
  });

  function projectOne(teamId: string): TeamSwarmProjection {
    const linked = registry.listByTeam(teamId);
    const status = teamInspection.inspectStatus(teamId);
    const coordination = teamInspection.inspectCoordination(teamId);

    const escalationStates = status.linkedCohortIds
      .map((cohortId) => cohortInspection.inspectCohortEscalation({ cohortId }).escalationState)
      .sort((left, right) => left.localeCompare(right));

    const linkedSwarms: TeamSwarmStatusRecord[] = linked
      .map((entry) => {
        const swarmProjection = swarmInspection.inspectSwarm(entry.swarmId);
        const linkedInvestigationIds = swarmProjection.investigations
          .map((investigation) => investigation.investigationRunId)
          .sort((left, right) => left.localeCompare(right));
        const linkedSynthesisIds = swarmProjection.syntheses
          .map((synthesis) => synthesis.synthesisId)
          .sort((left, right) => left.localeCompare(right));

        const hasInvestigationFailure = linkedInvestigationIds
          .map((investigationRunId) => investigationInspection.inspectCompletionStatus(investigationRunId).healthState)
          .some((healthState) => isFailureHealthState(healthState));

        const unresolvedConflictCount = swarmProjection.syntheses
          .reduce((total, synthesis) => total + synthesis.unresolvedConflictCount, 0);

        const activation = evaluateTeamSwarmActivation({
          teamId,
          swarmId: entry.swarmId,
          teamEnabled: entry.teamEnabled,
          linkedInvestigationCount: linkedInvestigationIds.length,
          unresolvedConflictCount,
          hasInvestigationFailure,
          teamCoordinationReadiness: coordination.readiness,
          teamPriority: coordination.priority,
          cohortEscalationStates: escalationStates
        });

        const readiness = evaluateTeamSwarmReadiness({
          teamId,
          swarmId: entry.swarmId,
          activated: activation.activated,
          linkedInvestigationCount: linkedInvestigationIds.length,
          unresolvedConflictCount,
          hasInvestigationFailure,
          swarmReadinessState: swarmProjection.readiness.readiness,
          completionSatisfied: swarmProjection.completion.isComplete
        });

        const priority = evaluateTeamSwarmPriority({
          teamId,
          swarmId: entry.swarmId,
          unresolvedConflictCount,
          hasInvestigationFailure,
          readiness: readiness.readiness,
          cohortEscalationStates: escalationStates
        });

        const hasInFlightInvestigations = swarmProjection.investigations.some((investigation) => (
          investigation.status === 'running'
          || investigation.status === 'awaiting_data'
          || investigation.status === 'scheduled_resume'
          || investigation.status === 'retry_pending'
          || investigation.status === 'pending'
        ));

        const lifecycle = evaluateTeamSwarmState({
          activated: activation.activated,
          readiness: readiness.readiness,
          completionSatisfied: swarmProjection.completion.isComplete,
          linkedInvestigationCount: linkedInvestigationIds.length,
          hasInFlightInvestigations,
          unresolvedConflictCount
        });

        const completion = evaluateTeamSwarmCompletion({
          teamId,
          swarmId: entry.swarmId,
          lifecycle,
          completedInvestigationCount: swarmProjection.completion.completedInvestigationCount,
          totalInvestigationCount: swarmProjection.completion.totalInvestigationCount,
          unresolvedConflictCount,
          completionSatisfied: swarmProjection.completion.isComplete
        });

        return {
          teamId,
          swarmId: entry.swarmId,
          swarmDisplayName: entry.swarmDisplayName,
          activation,
          priority,
          readiness,
          lifecycle,
          completion,
          linkedInvestigationIds,
          linkedSynthesisIds,
          reasons: toReasons({
            activationReasons: activation.reasons,
            priorityReasons: priority.reasons,
            readinessReasons: readiness.reasons,
            completionUnmet: completion.unmetRequirements
          })
        };
      })
      .sort((left, right) => left.swarmId.localeCompare(right.swarmId));

    const topicProgress = evaluateTeamTopicProgress({
      teamId,
      swarms: linkedSwarms
    });

    const history = historyStore.load(teamId);
    const artifactPaths = resolveTeamSwarmArtifactPaths({
      teamId,
      rootDir: options.teamSwarmArtifactsRoot
    });

    const teamDisplayName = linked[0]?.teamDisplayName ?? teamId;
    const summary = {
      totalSwarms: linkedSwarms.length,
      activeSwarms: linkedSwarms.filter((entry) => entry.lifecycle === 'activated' || entry.lifecycle === 'progressing' || entry.lifecycle === 'stabilizing').length,
      completedSwarms: linkedSwarms.filter((entry) => entry.lifecycle === 'completed').length,
      blockedSwarms: linkedSwarms.filter((entry) => entry.readiness.readiness === 'blocked').length
    };

    const statusPreview = {
      teamId,
      topicProgress,
      swarms: linkedSwarms.map((entry) => ({
        swarmId: entry.swarmId,
        priority: entry.priority.priority,
        lifecycle: entry.lifecycle,
        readiness: entry.readiness.readiness,
        completion: entry.completion.isComplete
      }))
    } as Record<string, unknown>;

    const reportPreview = {
      teamId,
      teamDisplayName,
      summary,
      topicProgress,
      linkedSwarms,
      history
    } as Record<string, unknown>;

    return {
      teamId,
      teamDisplayName,
      linkedSwarms,
      topicProgress,
      summary,
      historySummary: {
        totalEvents: history.entries.length,
        ...(history.entries[0] ? { lastEventType: history.entries[0].eventType } : {}),
        ...(history.entries[0] ? { lastEventDedupeKey: history.entries[0].eventDedupeKey } : {})
      },
      artifactPaths,
      statusPreview,
      reportPreview
    };
  }

  function projectAll(): TeamSwarmProjection[] {
    return registry
      .listTeamsWithSwarms()
      .map((entry) => projectOne(entry.teamId))
      .sort((left, right) => left.teamId.localeCompare(right.teamId));
  }

  return {
    projectOne,
    projectAll
  };
}

export type TeamSwarmProjectionEngine = ReturnType<typeof createTeamSwarmProjection>;
