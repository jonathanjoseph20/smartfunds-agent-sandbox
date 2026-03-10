import fs from 'node:fs';
import path from 'node:path';

import type { MissionDefinition } from './mission-types.ts';
import { validateMissionDefinitions } from './mission-validator.ts';

const DEFAULT_MISSIONS_DIR = 'control-plane/missions/definitions';

function loadJsonFiles<T>(dir: string): Array<{ file: string; data: T }> {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  const loaded: Array<{ file: string; data: T }> = [];

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loaded.push(...loadJsonFiles<T>(filePath));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    loaded.push({
      file: filePath,
      data: JSON.parse(raw) as T
    });
  }

  return loaded.sort((left, right) => left.file.localeCompare(right.file));
}

export function loadMissionDefinitionsFromDir(dir: string = DEFAULT_MISSIONS_DIR): MissionDefinition[] {
  const loaded = loadJsonFiles<unknown>(dir).map(({ data }) => data);
  return validateMissionDefinitions(loaded);
}

export function loadMissionDefinitionById(missionId: string, dir: string = DEFAULT_MISSIONS_DIR): MissionDefinition {
  const missions = loadMissionDefinitionsFromDir(dir);
  const mission = missions.find((entry) => entry.missionId === missionId);
  if (!mission) {
    throw new Error(`Mission definition not found: ${missionId}`);
  }
  return mission;
}
