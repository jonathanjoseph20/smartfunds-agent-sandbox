import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import type { ScheduleLaunchRecord } from '../scheduler/types.ts';
import type { AccumulatedArtifact, DatasetRecord, LongitudinalDataset, MissionPack, ResearchTeam } from './types.ts';

const DEFAULT_ARTIFACTS_ROOT = 'artifacts';
const DEFAULT_DATASET_BY_SCHEDULE: Record<string, string> = {
  'defi-liquidity-hourly-scan': 'protocol_tvl_timeseries',
  'defi-yield-hourly-scan': 'yield_rate_history',
  'defi-governance-hourly-scan': 'governance_vote_tracker'
};

const DEFAULT_SOURCE_FILE_BY_SCHEDULE: Record<string, string> = {
  'defi-liquidity-hourly-scan': 'liquidity-snapshot-json.json',
  'defi-yield-hourly-scan': 'yield-report-json.json',
  'defi-governance-hourly-scan': 'governance-events-json.json'
};

type DatasetMergeRow = {
  dedupeKey: string;
  record: DatasetRecord;
};

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJsonFile(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${canonicalStringify(value)}\n`, 'utf8');
}

function listFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function normalizedObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function stableRecordCompare(left: DatasetRecord, right: DatasetRecord): number {
  const slotCmp = left.slotId.localeCompare(right.slotId);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  const scheduleCmp = left.scheduleId.localeCompare(right.scheduleId);
  if (scheduleCmp !== 0) {
    return scheduleCmp;
  }
  const runCmp = left.runId.localeCompare(right.runId);
  if (runCmp !== 0) {
    return runCmp;
  }
  const missionCmp = left.sourceMission.localeCompare(right.sourceMission);
  if (missionCmp !== 0) {
    return missionCmp;
  }
  return canonicalStringify(left.data).localeCompare(canonicalStringify(right.data));
}

function rowDedupeKey(record: DatasetRecord): string {
  const raw = `${record.scheduleId}::${record.slotId}::${record.runId}::${record.sourceMission}::${canonicalStringify(record.data)}`;
  return sha256(raw);
}

function loadDataset(filePath: string, datasetKey: string): LongitudinalDataset {
  const loaded = readJsonFile<LongitudinalDataset | null>(filePath, null);
  if (!loaded) {
    return { datasetKey, records: [] };
  }

  if (loaded.datasetKey !== datasetKey || !Array.isArray(loaded.records)) {
    return { datasetKey, records: [] };
  }

  const records = loaded.records
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      scheduleId: String(entry.scheduleId),
      slotId: String(entry.slotId),
      runId: String(entry.runId),
      sourceMission: String(entry.sourceMission),
      data: normalizedObject(entry.data)
    }))
    .sort(stableRecordCompare);

  return {
    datasetKey,
    records
  };
}

function mergeDatasetRows(existing: LongitudinalDataset, incoming: DatasetRecord[]): LongitudinalDataset {
  const byKey = new Map<string, DatasetMergeRow>();

  for (const record of existing.records) {
    byKey.set(rowDedupeKey(record), {
      dedupeKey: rowDedupeKey(record),
      record
    });
  }

  for (const record of incoming) {
    const key = rowDedupeKey(record);
    if (!byKey.has(key)) {
      byKey.set(key, { dedupeKey: key, record });
    }
  }

  const records = Array.from(byKey.values())
    .map((entry) => entry.record)
    .sort(stableRecordCompare);

  return {
    datasetKey: existing.datasetKey,
    records
  };
}

function extractRowsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.entries, record.snapshots, record.events, record.rows];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
        .map((entry) => normalizedObject(entry));
    }
  }

  return [normalizedObject(record)];
}

function normalizeNamespace(namespace: string): string {
  const normalized = namespace.trim().replace(/\s+/g, '-');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) {
    throw new Error(`INVALID_NAMESPACE: ${namespace}`);
  }
  return normalized;
}

export type AccumulatorOptions = {
  artifactsRoot?: string;
  datasetBySchedule?: Record<string, string>;
  sourceFileBySchedule?: Record<string, string>;
};

export type AccumulationResult = {
  processed: boolean;
  launchKey: string;
  copiedArtifacts: AccumulatedArtifact[];
  updatedDatasets: string[];
};

export function createArtifactAccumulator(options: AccumulatorOptions = {}) {
  const artifactsRoot = options.artifactsRoot ?? DEFAULT_ARTIFACTS_ROOT;
  const datasetBySchedule = {
    ...DEFAULT_DATASET_BY_SCHEDULE,
    ...(options.datasetBySchedule ?? {})
  };
  const sourceFileBySchedule = {
    ...DEFAULT_SOURCE_FILE_BY_SCHEDULE,
    ...(options.sourceFileBySchedule ?? {})
  };

  function accumulateLaunch(input: {
    launch: ScheduleLaunchRecord;
    team: ResearchTeam;
    pack: MissionPack;
  }): AccumulationResult {
    const { launch, team, pack } = input;
    const launchKey = `${launch.scheduleId}::${launch.slotId}::${launch.runId ?? 'missing_run'}`;

    if (!launch.launched || !launch.runId) {
      return {
        processed: false,
        launchKey,
        copiedArtifacts: [],
        updatedDatasets: []
      };
    }

    const teamDir = path.join(artifactsRoot, team.teamId);
    const sourceRunDir = path.join(artifactsRoot, launch.missionId, launch.runId);
    const stateDir = path.join(teamDir, '_state');
    const datasetsDir = path.join(teamDir, 'datasets');

    ensureDir(stateDir);
    ensureDir(datasetsDir);

    const processedPath = path.join(stateDir, 'processed-launches.json');
    const processedLaunches = readJsonFile<string[]>(processedPath, [])
      .filter((entry) => typeof entry === 'string')
      .sort((left, right) => left.localeCompare(right));

    if (processedLaunches.includes(launchKey)) {
      return {
        processed: false,
        launchKey,
        copiedArtifacts: [],
        updatedDatasets: []
      };
    }

    const namespace = normalizeNamespace(
      pack.artifactNamespaces?.[launch.scheduleId] ?? launch.scheduleId
    );

    const copiedArtifacts: AccumulatedArtifact[] = [];

    for (const fileName of listFiles(sourceRunDir)) {
      const sourcePath = path.join(sourceRunDir, fileName);
      const artifactPath = path.join(teamDir, namespace, `${launch.slotId}__${launch.runId}__${fileName}`);
      ensureDir(path.dirname(artifactPath));
      fs.copyFileSync(sourcePath, artifactPath);

      copiedArtifacts.push({
        artifactType: path.extname(fileName).replace(/^\./, '') || 'artifact',
        sourceMission: launch.missionId,
        datasetKey: datasetBySchedule[launch.scheduleId] ?? 'unmapped_dataset',
        scheduleId: launch.scheduleId,
        slotId: launch.slotId,
        runId: launch.runId,
        sourcePath,
        artifactPath
      });
    }

    const sourceFileName = sourceFileBySchedule[launch.scheduleId];
    const updatedDatasets: string[] = [];

    if (sourceFileName && datasetBySchedule[launch.scheduleId]) {
      const sourceFilePath = path.join(sourceRunDir, sourceFileName);
      if (fs.existsSync(sourceFilePath)) {
        const sourcePayload = readJsonFile<unknown>(sourceFilePath, {});
        const rows = extractRowsFromPayload(sourcePayload);
        const datasetKey = datasetBySchedule[launch.scheduleId];
        const datasetPath = path.join(datasetsDir, `${datasetKey}.json`);

        const incomingRecords: DatasetRecord[] = rows.map((row) => ({
          scheduleId: launch.scheduleId,
          slotId: launch.slotId,
          runId: launch.runId,
          sourceMission: launch.missionId,
          data: row
        }));

        const currentDataset = loadDataset(datasetPath, datasetKey);
        const merged = mergeDatasetRows(currentDataset, incomingRecords);
        writeJsonFile(datasetPath, merged);
        updatedDatasets.push(datasetKey);
      }
    }

    const updatedProcessed = [...processedLaunches, launchKey].sort((left, right) => left.localeCompare(right));
    writeJsonFile(processedPath, updatedProcessed);

    const ledgerPath = path.join(stateDir, 'accumulated-artifacts.json');
    const existingLedger = readJsonFile<AccumulatedArtifact[]>(ledgerPath, []);
    const mergedLedger = [...existingLedger, ...copiedArtifacts]
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => ({
        artifactType: String(entry.artifactType),
        sourceMission: String(entry.sourceMission),
        datasetKey: String(entry.datasetKey),
        scheduleId: String(entry.scheduleId),
        slotId: String(entry.slotId),
        runId: String(entry.runId),
        sourcePath: String(entry.sourcePath),
        artifactPath: String(entry.artifactPath)
      }))
      .sort((left, right) => {
        const scheduleCmp = left.scheduleId.localeCompare(right.scheduleId);
        if (scheduleCmp !== 0) {
          return scheduleCmp;
        }
        const slotCmp = left.slotId.localeCompare(right.slotId);
        if (slotCmp !== 0) {
          return slotCmp;
        }
        const runCmp = left.runId.localeCompare(right.runId);
        if (runCmp !== 0) {
          return runCmp;
        }
        return left.artifactPath.localeCompare(right.artifactPath);
      });

    writeJsonFile(ledgerPath, mergedLedger);

    return {
      processed: true,
      launchKey,
      copiedArtifacts: copiedArtifacts.sort((left, right) => left.artifactPath.localeCompare(right.artifactPath)),
      updatedDatasets: Array.from(new Set(updatedDatasets)).sort((left, right) => left.localeCompare(right))
    };
  }

  function listDatasets(teamId: string): string[] {
    const datasetsDir = path.join(artifactsRoot, teamId, 'datasets');
    return listFiles(datasetsDir)
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => entry.replace(/\.json$/, ''))
      .sort((left, right) => left.localeCompare(right));
  }

  function readDataset(input: { teamId: string; datasetKey: string }): LongitudinalDataset {
    const datasetPath = path.join(artifactsRoot, input.teamId, 'datasets', `${input.datasetKey}.json`);
    return loadDataset(datasetPath, input.datasetKey);
  }

  return {
    accumulateLaunch,
    listDatasets,
    readDataset
  };
}

export type ArtifactAccumulator = ReturnType<typeof createArtifactAccumulator>;
