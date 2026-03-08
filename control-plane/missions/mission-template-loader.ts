import fs from 'node:fs';
import path from 'node:path';

import type { MissionTemplateDefinition } from './mission-control-types.ts';
import { validateMissionTemplateDefinitions } from './mission-template-validator.ts';

const DEFAULT_TEMPLATE_DIR = 'control-plane/missions/templates';

function loadJsonFiles(dir: string): unknown[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8')) as unknown);
}

export function loadMissionTemplatesFromDir(dir: string = DEFAULT_TEMPLATE_DIR): MissionTemplateDefinition[] {
  return validateMissionTemplateDefinitions(loadJsonFiles(dir));
}

export function loadMissionTemplateById(templateId: string, dir: string = DEFAULT_TEMPLATE_DIR): MissionTemplateDefinition {
  const templates = loadMissionTemplatesFromDir(dir);
  const template = templates.find((entry) => entry.missionId === templateId);
  if (!template) {
    throw new Error(`Mission template not found: ${templateId}`);
  }
  return template;
}
