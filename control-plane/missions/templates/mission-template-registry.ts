import fs from 'node:fs';
import path from 'node:path';

import type { MissionTemplateDefinition } from './mission-template-types.ts';
import { validateMissionTemplateDefinition } from './mission-template-validator.ts';

export const DEFAULT_MISSION_TEMPLATE_DEFINITIONS_DIR = 'control-plane/missions/templates/definitions';

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

export function loadMissionTemplates(options: { definitionsDir?: string } = {}): MissionTemplateDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_MISSION_TEMPLATE_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new Error(`MISSION_TEMPLATE_DEFINITIONS_NOT_FOUND: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  const loaded = files.map((fileName) => {
    const filePath = path.join(definitionsDir, fileName);
    return validateMissionTemplateDefinition(readJson(filePath), fileName);
  });

  const seenTemplateIds = new Set<string>();
  for (const definition of loaded) {
    if (seenTemplateIds.has(definition.templateId)) {
      throw new Error(`Duplicate mission template: ${definition.templateId}`);
    }
    seenTemplateIds.add(definition.templateId);
  }

  return loaded.sort((left, right) => left.templateId.localeCompare(right.templateId));
}

export function listMissionTemplates(options: { definitionsDir?: string } = {}): MissionTemplateDefinition[] {
  return loadMissionTemplates(options).sort((left, right) => left.templateId.localeCompare(right.templateId));
}

export function getMissionTemplate(templateId: string, options: { definitionsDir?: string } = {}): MissionTemplateDefinition {
  const template = listMissionTemplates(options).find((entry) => entry.templateId === templateId);
  if (!template) {
    throw new Error(`Unknown mission template: ${templateId}`);
  }

  return template;
}
