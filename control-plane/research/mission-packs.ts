import fs from 'node:fs';
import path from 'node:path';

import { loadScheduleRegistry } from '../scheduler/registry.ts';
import type { MissionPack } from './types.ts';

export const DEFAULT_RESEARCH_PACKS_DIR = 'control-plane/research/packs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeStringMap(value: unknown, label: string): Record<string, string> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object of non-empty string values.`);
  }

  const entries = Object.entries(value)
    .map(([key, entryValue]) => {
      const normalizedKey = asTrimmedString(key);
      const normalizedValue = asTrimmedString(entryValue);
      if (!normalizedKey || !normalizedValue) {
        throw new Error(`${label} must be an object of non-empty string values.`);
      }
      return [normalizedKey, normalizedValue] as const;
    })
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(entries);
}

function parseMissionPack(value: unknown, sourceLabel: string): MissionPack {
  if (!isRecord(value)) {
    throw new Error(`Mission pack definition ${sourceLabel} must be an object.`);
  }

  const packId = asTrimmedString(value.packId);
  const teamId = asTrimmedString(value.teamId);
  if (!packId) {
    throw new Error(`Mission pack definition ${sourceLabel} packId must be a non-empty string.`);
  }
  if (!teamId) {
    throw new Error(`Mission pack ${packId} teamId must be a non-empty string.`);
  }

  if (!Array.isArray(value.schedules) || !value.schedules.every((entry) => asTrimmedString(entry))) {
    throw new Error(`Mission pack ${packId} schedules must be an array of non-empty strings.`);
  }

  const schedules = sortedUnique(value.schedules.map((entry) => String(entry).trim()));
  if (schedules.length === 0) {
    throw new Error(`Mission pack ${packId} schedules must include at least one schedule.`);
  }

  const description = value.description === undefined ? undefined : asTrimmedString(value.description);
  if (value.description !== undefined && !description) {
    throw new Error(`Mission pack ${packId} description must be a non-empty string when provided.`);
  }

  const summaryScheduleId = value.summaryScheduleId === undefined ? undefined : asTrimmedString(value.summaryScheduleId);
  if (value.summaryScheduleId !== undefined && !summaryScheduleId) {
    throw new Error(`Mission pack ${packId} summaryScheduleId must be a non-empty string when provided.`);
  }

  const artifactNamespaces = value.artifactNamespaces === undefined
    ? undefined
    : normalizeStringMap(value.artifactNamespaces, `Mission pack ${packId} artifactNamespaces`);

  return {
    packId,
    teamId,
    schedules,
    ...(description ? { description } : {}),
    ...(artifactNamespaces ? { artifactNamespaces } : {}),
    ...(summaryScheduleId ? { summaryScheduleId } : {})
  };
}

function loadJsonFiles(dir: string): Array<{ filePath: string; parsed: unknown }> {
  const resolvedDir = path.resolve(dir);
  if (!fs.existsSync(resolvedDir)) {
    return [];
  }

  return fs.readdirSync(resolvedDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => {
      const filePath = path.join(resolvedDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return { filePath, parsed };
    });
}

export function validateMissionPacks(input: {
  packs: MissionPack[];
  validScheduleIds?: string[];
}): MissionPack[] {
  const seen = new Set<string>();
  const scheduleSet = input.validScheduleIds ? new Set(input.validScheduleIds) : null;

  const normalized = input.packs.map((pack) => {
    if (seen.has(pack.packId)) {
      throw new Error(`Duplicate mission packId detected: ${pack.packId}`);
    }
    seen.add(pack.packId);

    const schedules = sortedUnique(pack.schedules);
    if (scheduleSet) {
      const unknown = schedules.filter((scheduleId) => !scheduleSet.has(scheduleId));
      if (unknown.length > 0) {
        throw new Error(`Mission pack ${pack.packId} references unknown schedules: ${unknown.join(', ')}`);
      }
    }

    if (pack.summaryScheduleId && !schedules.includes(pack.summaryScheduleId)) {
      throw new Error(`Mission pack ${pack.packId} summaryScheduleId must be in schedules.`);
    }

    return {
      ...pack,
      schedules,
      ...(pack.artifactNamespaces
        ? {
          artifactNamespaces: Object.fromEntries(
            Object.entries(pack.artifactNamespaces).sort(([left], [right]) => left.localeCompare(right))
          )
        }
        : {})
    };
  });

  return [...normalized].sort((left, right) => left.packId.localeCompare(right.packId));
}

export function loadMissionPacks(input: {
  packsDir?: string;
  scheduleRegistryPath?: string;
} = {}): MissionPack[] {
  const packsDir = input.packsDir ?? DEFAULT_RESEARCH_PACKS_DIR;
  const files = loadJsonFiles(packsDir);
  const packs = files.map((entry) => parseMissionPack(entry.parsed, path.basename(entry.filePath)));

  const schedules = loadScheduleRegistry(input.scheduleRegistryPath).schedules.map((entry) => entry.scheduleId);
  return validateMissionPacks({ packs, validScheduleIds: schedules });
}

export function getMissionPackById(input: {
  packId: string;
  packsDir?: string;
  scheduleRegistryPath?: string;
}): MissionPack {
  const found = loadMissionPacks(input).find((entry) => entry.packId === input.packId);
  if (!found) {
    throw new Error(`MISSION_PACK_NOT_FOUND: ${input.packId}`);
  }
  return found;
}

export function listMissionPackSchedules(input: {
  packId: string;
  packsDir?: string;
  scheduleRegistryPath?: string;
}): string[] {
  return getMissionPackById(input).schedules;
}
