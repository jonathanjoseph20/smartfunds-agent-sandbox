export type ResearchTeam = {
  teamId: string;
  missionPackId: string;
  description: string;
  displayName?: string;
  datasetKeys?: string[];
  summaryArtifactPath?: string;
  enabled?: boolean;
};

export type MissionPack = {
  packId: string;
  teamId: string;
  description?: string;
  schedules: string[];
  artifactNamespaces?: Record<string, string>;
  summaryScheduleId?: string;
};

export type AccumulatedArtifact = {
  artifactType: string;
  sourceMission: string;
  datasetKey: string;
  scheduleId: string;
  slotId: string;
  runId: string;
  sourcePath: string;
  artifactPath: string;
};

export type DatasetRecord = {
  scheduleId: string;
  slotId: string;
  runId: string;
  sourceMission: string;
  data: Record<string, unknown>;
};

export type LongitudinalDataset = {
  datasetKey: string;
  records: DatasetRecord[];
};

export type IntelligenceSummary = {
  reportDate: string;
  liquidityHighlights: string[];
  yieldMovements: string[];
  governanceEvents: string[];
  riskSignals: string[];
  watchlist: string[];
};

export type TeamSummaryArtifacts = {
  jsonPath: string;
  markdownPath: string;
};
