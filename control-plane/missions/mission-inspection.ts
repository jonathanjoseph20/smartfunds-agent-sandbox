import {
  createMissionHistoryStore,
  type MissionHistoryStore,
} from './mission-history-store.ts';
import {
  createMissionMaterializer,
  type MissionMaterializer,
} from './mission-materializer.ts';
import {
  createMissionProjection,
  type MissionProjectionEngine,
} from './mission-projection.ts';
import {
  createMissionRegistry,
  type MissionRegistry,
} from './mission-registry.ts';

export function createMissionInspection(options: {
  registry?: MissionRegistry;
  projection?: MissionProjectionEngine;
  historyStore?: MissionHistoryStore;
  materializer?: MissionMaterializer;
  definitionsDir?: string;
  instancesDir?: string;
  missionArtifactsRoot?: string;
} = {}) {
  const registry = options.registry ?? createMissionRegistry({
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
  });

  const historyStore = options.historyStore ?? createMissionHistoryStore({
    artifactsRoot: options.missionArtifactsRoot,
  });

  const projection = options.projection ?? createMissionProjection({
    registry,
    historyStore,
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
  });

  const materializer = options.materializer ?? createMissionMaterializer({
    projection,
    historyStore,
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
  });

  function listMissions() {
    return projection.projectAll()
      .map((entry) => ({
        missionId: entry.missionId,
        missionType: entry.missionType,
        displayName: entry.displayName,
        approvalState: entry.status.approvalState,
        lifecycleState: entry.status.lifecycleState,
        readinessState: entry.status.readinessState,
        completionState: entry.status.completionState,
      }))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  function inspectMission(missionId: string) {
    return projection.projectOne(missionId);
  }

  function getMissionStatus(missionId: string) {
    return projection.projectOne(missionId).statusPreview;
  }

  function getMissionHistory(missionId: string) {
    registry.getMissionInstance(missionId);
    return historyStore.load(missionId);
  }

  function summarizeDeliverables(missionId: string) {
    return projection.projectOne(missionId).deliverableSummary;
  }

  function materializeMission(missionId: string) {
    return materializer.materializeOne(missionId);
  }

  return {
    listMissions,
    inspectMission,
    getMissionStatus,
    getMissionHistory,
    summarizeDeliverables,
    materializeMission,
  };
}

export type MissionInspection = ReturnType<typeof createMissionInspection>;
