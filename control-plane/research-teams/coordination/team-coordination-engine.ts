import { createCohortInspection, type CohortInspection } from '../../cohorts/cohort-inspection.ts';
import { createInvestigationInspection, type InvestigationInspection } from '../../investigations/investigation-inspection.ts';
import { createResearchTeamAttachmentResolver, type ResearchTeamAttachmentResolver } from '../research-team-attachment.ts';
import { createResearchTeamRegistry, type ResearchTeamRegistry } from '../research-team-registry.ts';
import { createResearchTeamStatusEvaluator, type ResearchTeamStatusEvaluator } from '../research-team-status.ts';
import { createSynthesisInspection, type SynthesisInspection } from '../../synthesis/synthesis-inspection.ts';

import { projectTeamCoordinationState } from './team-coordination-projection.ts';
import { createTeamPolicyRegistry, type TeamPolicyRegistry } from './team-policy-registry.ts';
import { evaluateTeamPriority } from './team-priority-engine.ts';
import { evaluateTeamReadiness } from './team-readiness.ts';
import { routeTeamInvestigation } from './team-routing-engine.ts';
import { evaluateTeamStabilization } from './team-stabilization-engine.ts';
import { createTeamCoordinationStore, type TeamCoordinationStore } from './team-coordination-store.ts';
import type {
  TeamCoordinationEvent,
  TeamCoordinationProjection,
  TeamResponsePriority,
  TeamStabilizationEvaluation,
  TeamRoutingDecision,
  TeamPriorityEvaluation,
  TeamReadinessEvaluation
} from './team-coordination-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isEscalation(state: string): boolean {
  return state === 'elevated' || state === 'escalated' || state === 'critical';
}

function isFailureHealthState(healthState: string): boolean {
  return healthState === 'degraded' || healthState === 'unhealthy' || healthState === 'inconclusive';
}

function isResolvedReadinessState(readinessState: string): boolean {
  return readinessState === 'complete' || readinessState === 'ready_to_finalize';
}

type TeamCoordinationComputed = {
  teamId: string;
  linkedCohortIds: string[];
  linkedInvestigationIds: string[];
  cohortEscalationStates: Record<string, string>;
  routingDecision: TeamRoutingDecision | null;
  priorityEvaluation: TeamPriorityEvaluation;
  stabilizationEvaluation: TeamStabilizationEvaluation;
  readinessEvaluation: TeamReadinessEvaluation;
  healthyNow: boolean;
};

function shouldEmitStabilizationEvent(input: {
  previous: TeamCoordinationProjection;
  next: TeamStabilizationEvaluation;
}): boolean {
  if (input.next.stabilizationState === 'resolved') {
    return input.previous.stabilizationState !== 'resolved' || input.previous.healthySlotCount !== input.next.healthySlotCount;
  }

  return input.previous.stabilizationState !== 'stabilizing' || input.previous.healthySlotCount !== input.next.healthySlotCount;
}

export function createTeamCoordinationEngine(options: {
  teamRegistry?: ResearchTeamRegistry;
  attachmentResolver?: ResearchTeamAttachmentResolver;
  teamStatusEvaluator?: ResearchTeamStatusEvaluator;
  cohortInspection?: CohortInspection;
  investigationInspection?: InvestigationInspection;
  synthesisInspection?: SynthesisInspection;
  policyRegistry?: TeamPolicyRegistry;
  coordinationStore?: TeamCoordinationStore;
  teamDefinitionsDir?: string;
  policyDefinitionsDir?: string;
  cohortDefinitionsDir?: string;
  cohortProgramDefinitionsDir?: string;
  cohortArtifactsRoot?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  coordinationArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const teamRegistry = options.teamRegistry ?? createResearchTeamRegistry({ definitionsDir: options.teamDefinitionsDir });
  const attachmentResolver = options.attachmentResolver ?? createResearchTeamAttachmentResolver({
    teamRegistry,
    teamDefinitionsDir: options.teamDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir
  });
  const teamStatusEvaluator = options.teamStatusEvaluator ?? createResearchTeamStatusEvaluator({
    teamRegistry,
    attachmentResolver,
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
    now: options.now
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
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
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
  const policyRegistry = options.policyRegistry ?? createTeamPolicyRegistry({
    definitionsDir: options.policyDefinitionsDir
  });
  const coordinationStore = options.coordinationStore ?? createTeamCoordinationStore({
    artifactsRoot: options.coordinationArtifactsRoot
  });

  function projectCurrent(teamId: string): TeamCoordinationProjection {
    const history = coordinationStore.load(teamId);
    return projectTeamCoordinationState({ teamId, entries: history.entries });
  }

  function compute(input: { teamId: string; signalSeverity?: TeamResponsePriority }): TeamCoordinationComputed {
    const team = teamRegistry.getResearchTeam(input.teamId);
    const policy = policyRegistry.getPolicy(input.teamId);
    const status = teamStatusEvaluator.evaluateTeamStatus(input.teamId);

    const linkedCohortIds = [...status.linkedCohortIds].sort((left, right) => left.localeCompare(right));
    const linkedInvestigationIds = [...status.linkedInvestigationIds].sort((left, right) => left.localeCompare(right));

    const cohortEscalationStates = Object.fromEntries(linkedCohortIds
      .map((cohortId) => [cohortId, cohortInspection.inspectCohortEscalation({ cohortId }).escalationState])
      .sort(([left], [right]) => String(left).localeCompare(String(right))));

    const routingDecision = routeTeamInvestigation({
      teamId: input.teamId,
      linkedCohortIds,
      cohortEscalationStates,
      routingRules: policy.routingRules
    });

    const hasEscalation = linkedCohortIds.some((cohortId) => isEscalation(cohortEscalationStates[cohortId] ?? 'none'));

    const completionStates = linkedInvestigationIds.map((investigationId) => investigationInspection.inspectCompletionStatus(investigationId));
    const unresolvedInvestigations = completionStates
      .filter((entry) => !isResolvedReadinessState(entry.readinessState))
      .map((entry) => entry.investigationRunId)
      .sort((left, right) => left.localeCompare(right));

    const hasInvestigationFailure = completionStates.some((entry) => isFailureHealthState(entry.healthState));

    const synthesisConflictCount = status.linkedSynthesisIds
      .map((synthesisId) => synthesisInspection.inspectConflicts(synthesisId).conflicts.length)
      .reduce((total, count) => total + count, 0);

    const priorityEvaluation = evaluateTeamPriority({
      teamId: input.teamId,
      priorityRules: policy.priorityRules,
      hasEscalation,
      hasInvestigationFailure,
      hasSynthesisConflict: synthesisConflictCount > 0,
      ...(input.signalSeverity ? { signalSeverity: input.signalSeverity } : {})
    });

    const previousProjection = projectCurrent(input.teamId);
    const healthyNow = linkedCohortIds.length > 0
      && linkedCohortIds.every((cohortId) => cohortInspection.inspectStatus(cohortId).health === 'healthy')
      && linkedCohortIds.every((cohortId) => !isEscalation(cohortEscalationStates[cohortId] ?? 'none'));

    const healthySlotCount = healthyNow ? previousProjection.healthySlotCount + 1 : 0;

    const stabilizationEvaluation = evaluateTeamStabilization({
      teamId: input.teamId,
      healthySlotCount,
      unresolvedInvestigationCount: unresolvedInvestigations.length,
      synthesisConflictCount,
      stabilizationRules: policy.stabilizationRules
    });

    const readinessEvaluation = evaluateTeamReadiness({
      teamId: input.teamId,
      teamEnabled: team.enabled,
      hasLinkedCohorts: linkedCohortIds.length > 0,
      hasEscalation,
      activeInvestigationIds: unresolvedInvestigations,
      priority: priorityEvaluation.priority,
      stabilizationState: stabilizationEvaluation.stabilizationState
    });

    return {
      teamId: input.teamId,
      linkedCohortIds,
      linkedInvestigationIds: uniqueSorted(unresolvedInvestigations),
      cohortEscalationStates,
      routingDecision,
      priorityEvaluation,
      stabilizationEvaluation,
      readinessEvaluation,
      healthyNow
    };
  }

  function buildEvents(input: {
    computed: TeamCoordinationComputed;
    previousProjection: TeamCoordinationProjection;
    slotReference?: string;
  }): Omit<TeamCoordinationEvent, 'eventDedupeKey'>[] {
    const events: Omit<TeamCoordinationEvent, 'eventDedupeKey'>[] = [];

    if (input.computed.routingDecision) {
      events.push({
        eventType: 'investigation_routed',
        teamId: input.computed.teamId,
        linkedCohortIds: input.computed.linkedCohortIds,
        linkedInvestigationIds: input.computed.linkedInvestigationIds,
        priority: input.computed.priorityEvaluation.priority,
        readiness: input.computed.readinessEvaluation.readiness,
        stabilizationState: input.computed.stabilizationEvaluation.stabilizationState,
        reason: input.computed.routingDecision.reason,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
        routedInvestigationTemplate: input.computed.routingDecision.investigationTemplate,
        healthySlotCount: input.computed.stabilizationEvaluation.healthySlotCount
      });
    }

    if (input.previousProjection.priority !== input.computed.priorityEvaluation.priority) {
      events.push({
        eventType: 'response_priority_changed',
        teamId: input.computed.teamId,
        linkedCohortIds: input.computed.linkedCohortIds,
        linkedInvestigationIds: input.computed.linkedInvestigationIds,
        priority: input.computed.priorityEvaluation.priority,
        readiness: input.computed.readinessEvaluation.readiness,
        stabilizationState: input.computed.stabilizationEvaluation.stabilizationState,
        reason: input.computed.priorityEvaluation.reasons.join('|'),
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
        healthySlotCount: input.computed.stabilizationEvaluation.healthySlotCount
      });
    }

    if (shouldEmitStabilizationEvent({
      previous: input.previousProjection,
      next: input.computed.stabilizationEvaluation
    })) {
      events.push({
        eventType: input.computed.stabilizationEvaluation.stabilizationState === 'resolved'
          ? 'response_resolved'
          : 'response_stabilizing',
        teamId: input.computed.teamId,
        linkedCohortIds: input.computed.linkedCohortIds,
        linkedInvestigationIds: input.computed.linkedInvestigationIds,
        priority: input.computed.priorityEvaluation.priority,
        readiness: input.computed.readinessEvaluation.readiness,
        stabilizationState: input.computed.stabilizationEvaluation.stabilizationState,
        reason: input.computed.stabilizationEvaluation.reasons.join('|') || 'stabilization_conditions_satisfied',
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
        healthySlotCount: input.computed.stabilizationEvaluation.healthySlotCount
      });
    }

    return events;
  }

  function inspectTeam(input: { teamId: string; signalSeverity?: TeamResponsePriority }) {
    const policy = policyRegistry.getPolicy(input.teamId);
    const history = coordinationStore.load(input.teamId);
    const projection = projectCurrent(input.teamId);
    const computed = compute(input);

    return {
      teamId: input.teamId,
      policy,
      projection,
      history,
      priority: computed.priorityEvaluation.priority,
      readiness: computed.readinessEvaluation.readiness,
      activeInvestigations: computed.linkedInvestigationIds,
      stabilizationState: computed.stabilizationEvaluation.stabilizationState,
      routingDecision: computed.routingDecision,
      priorityEvaluation: computed.priorityEvaluation,
      stabilizationEvaluation: computed.stabilizationEvaluation,
      readinessEvaluation: computed.readinessEvaluation
    };
  }

  function evaluateTeam(input: { teamId: string; slotReference?: string; signalSeverity?: TeamResponsePriority }) {
    const previousProjection = projectCurrent(input.teamId);
    const computed = compute({
      teamId: input.teamId,
      ...(input.signalSeverity ? { signalSeverity: input.signalSeverity } : {})
    });

    const events = buildEvents({
      computed,
      previousProjection,
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    });

    const appendedEvents = events
      .map((event) => coordinationStore.append(event))
      .filter((result) => result.appended)
      .map((result) => result.entry);

    const history = coordinationStore.load(input.teamId);
    const projection = projectTeamCoordinationState({
      teamId: input.teamId,
      entries: history.entries
    });

    return {
      teamId: input.teamId,
      appendedEvents,
      history,
      projection,
      routingDecision: computed.routingDecision,
      priorityEvaluation: computed.priorityEvaluation,
      stabilizationEvaluation: computed.stabilizationEvaluation,
      readinessEvaluation: computed.readinessEvaluation
    };
  }

  return {
    inspectTeam,
    evaluateTeam,
    projectCurrent
  };
}

export type TeamCoordinationEngine = ReturnType<typeof createTeamCoordinationEngine>;
