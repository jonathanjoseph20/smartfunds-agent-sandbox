import {
  createTeamMaterializer,
  type TeamMaterializer,
} from './team-materializer.ts';
import {
  createTeamProjection,
  type TeamProjectionEngine,
} from './team-projection.ts';
import {
  createTeamRegistry,
  type TeamRegistry,
} from './team-registry.ts';

export function createTeamInspection(options: {
  registry?: TeamRegistry;
  projection?: TeamProjectionEngine;
  materializer?: TeamMaterializer;
  definitionsDir?: string;
  artifactsRoot?: string;
} = {}) {
  const registry = options.registry ?? createTeamRegistry({ definitionsDir: options.definitionsDir });
  const projection = options.projection ?? createTeamProjection({
    registry,
    definitionsDir: options.definitionsDir,
  });
  const materializer = options.materializer ?? createTeamMaterializer({
    projection,
    definitionsDir: options.definitionsDir,
    artifactsRoot: options.artifactsRoot,
  });

  function listTeams() {
    return projection
      .projectAll()
      .map((entry) => entry.summary)
      .sort((left, right) => left.teamId.localeCompare(right.teamId));
  }

  function inspectTeam(teamId: string) {
    return projection.projectOne(teamId);
  }

  function getTeamStatus(teamId: string) {
    return projection.projectOne(teamId).status;
  }

  function getTeamHistory(teamId: string) {
    return projection.projectOne(teamId).history;
  }

  function summarizeSupportedMissionTypes(teamId: string) {
    return {
      teamId,
      supportedMissionTypes: projection
        .projectOne(teamId)
        .definition.supportedMissionTypes
        .slice()
        .sort((left, right) => left.localeCompare(right)),
    };
  }

  function summarizeSupportedTemplateIds(teamId: string) {
    return {
      teamId,
      supportedTemplateIds: projection
        .projectOne(teamId)
        .definition.supportedTemplateIds
        .slice()
        .sort((left, right) => left.localeCompare(right)),
    };
  }

  function summarizeStates(teamId: string) {
    const status = getTeamStatus(teamId);
    return {
      teamId,
      lifecycleState: status.lifecycleState,
      availabilityState: status.availabilityState,
      readinessState: status.readinessState,
    };
  }

  function materializeTeam(teamId: string) {
    return materializer.materializeOne(teamId);
  }

  return {
    listTeams,
    inspectTeam,
    getTeamStatus,
    getTeamHistory,
    summarizeSupportedMissionTypes,
    summarizeSupportedTemplateIds,
    summarizeStates,
    materializeTeam,
  };
}

export type TeamInspection = ReturnType<typeof createTeamInspection>;
