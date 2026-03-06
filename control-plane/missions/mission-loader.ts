import fs from 'node:fs';
import path from 'node:path';

import type { MissionDefinition } from './mission-types.ts';
import { validateMissionDefinitions } from './mission-validator.ts';

const DEFAULT_MISSIONS_DIR = 'control-plane/missions/definitions';

function loadJsonFiles<T>(dir: string): Array<{ file: string; data: T }> {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => {
      const filePath = path.join(dir, entry);
      const raw = fs.readFileSync(filePath, 'utf8');
      return {
        file: entry,
        data: JSON.parse(raw) as T
      };
    });
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
