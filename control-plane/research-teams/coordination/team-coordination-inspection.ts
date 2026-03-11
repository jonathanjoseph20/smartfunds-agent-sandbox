import {
  createTeamCoordinationEngine,
  type TeamCoordinationEngine
} from './team-coordination-engine.ts';
import {
  createTeamPolicyRegistry,
  type TeamPolicyRegistry
} from './team-policy-registry.ts';
import type { TeamResponsePriority } from './team-coordination-types.ts';

export function createTeamCoordinationInspection(options: {
  engine?: TeamCoordinationEngine;
  policyRegistry?: TeamPolicyRegistry;
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
  const policyRegistry = options.policyRegistry ?? createTeamPolicyRegistry({
    definitionsDir: options.policyDefinitionsDir
  });
  const engine = options.engine ?? createTeamCoordinationEngine({
    teamDefinitionsDir: options.teamDefinitionsDir,
    policyDefinitionsDir: options.policyDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    coordinationArtifactsRoot: options.coordinationArtifactsRoot,
    now: options.now
  });

  function inspectPolicy(teamId: string) {
    return policyRegistry.getPolicy(teamId);
  }

  function inspectCoordination(teamId: string, signalSeverity?: TeamResponsePriority) {
    return engine.inspectTeam({
      teamId,
      ...(signalSeverity ? { signalSeverity } : {})
    });
  }

  function inspectPriorities(teamId: string, signalSeverity?: TeamResponsePriority) {
    const inspected = inspectCoordination(teamId, signalSeverity);
    return {
      teamId,
      priority: inspected.priority,
      priorityEvaluation: inspected.priorityEvaluation
    };
  }

  function inspectStabilization(teamId: string, signalSeverity?: TeamResponsePriority) {
    const inspected = inspectCoordination(teamId, signalSeverity);
    return {
      teamId,
      stabilizationState: inspected.stabilizationState,
      stabilizationEvaluation: inspected.stabilizationEvaluation,
      readiness: inspected.readiness,
      readinessEvaluation: inspected.readinessEvaluation
    };
  }

  function evaluateCoordination(input: { teamId: string; slotReference?: string; signalSeverity?: TeamResponsePriority }) {
    return engine.evaluateTeam(input);
  }

  return {
    inspectPolicy,
    inspectCoordination,
    inspectPriorities,
    inspectStabilization,
    evaluateCoordination
  };
}

export type TeamCoordinationInspection = ReturnType<typeof createTeamCoordinationInspection>;
