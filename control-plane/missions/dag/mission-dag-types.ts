export interface MissionDAGDefinition {
  dagId: string;
  displayName: string;
  description?: string;
  rootMissionId: string;
  nodes: MissionDAGNode[];
  edges: MissionDAGEdge[];
  tags?: string[];
}

export interface MissionDAGNode {
  missionId: string;
}

export interface MissionDAGEdge {
  parentMissionId: string;
  childMissionId: string;
}

export const MISSION_DAG_STATUSES = [
  'READY',
  'BLOCKED',
  'INCOMPLETE',
  'COMPLETED',
  'INCONCLUSIVE',
] as const;

export type MissionDAGStatus = typeof MISSION_DAG_STATUSES[number];

export const MISSION_DAG_HISTORY_EVENT_TYPES = [
  'dag_created',
  'dag_archived',
  'mission_added',
  'mission_removed',
  'dependency_added',
  'dependency_removed',
] as const;

export type MissionDAGHistoryEventType = typeof MISSION_DAG_HISTORY_EVENT_TYPES[number];

export interface MissionDAGHistoryEntry {
  dagId: string;
  eventType: MissionDAGHistoryEventType;
  eventDedupeKey: string;
  payload: Record<string, unknown>;
  reasoning: string;
  slotReference?: string;
}

export interface MissionDAGHistory {
  dagId: string;
  entries: MissionDAGHistoryEntry[];
}

export interface MissionDAGNodeState {
  missionId: string;
  state: MissionDAGStatus;
  dependencyMissionIds: string[];
}

export interface MissionDAGStatusProjection {
  dagId: string;
  rootMissionId: string;
  nodeStates: MissionDAGNodeState[];
  blockedNodes: string[];
  readyNodes: string[];
  completedNodes: string[];
  incompleteNodes: string[];
  dagStatus: MissionDAGStatus;
}

export interface MissionDAGProjection extends MissionDAGStatusProjection {
  nodes: MissionDAGNode[];
  edges: MissionDAGEdge[];
}
