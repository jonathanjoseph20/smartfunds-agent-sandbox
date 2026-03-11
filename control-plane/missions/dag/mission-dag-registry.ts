import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../../finance/determinism.ts';
import { createMissionRegistry, type MissionRegistry } from '../mission-registry.ts';

import type { MissionDAGDefinition } from './mission-dag-types.ts';
import {
  buildMissionDAGIdentityPayload,
  normalizeMissionDAGDefinition,
  validateMissionDAGDefinition as validateMissionDAGDefinitionWithContext,
} from './mission-dag-validator.ts';

export const DEFAULT_MISSION_DAG_DEFINITIONS_DIR = 'control-plane/missions/definitions/mission-dags';

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

export function computeMissionDAGId(input: {
  rootMissionId: string;
  nodes: Array<{ missionId: string }>;
  edges: Array<{ parentMissionId: string; childMissionId: string }>;
}): string {
  const identityPayload = buildMissionDAGIdentityPayload({
    rootMissionId: input.rootMissionId,
    nodes: input.nodes,
    edges: input.edges,
  });

  return sha256(canonicalStringify(identityPayload));
}

export function validateMissionDAGDefinition(input: {
  value: unknown;
  sourceLabel?: string;
  knownMissionIds: string[];
}): MissionDAGDefinition {
  const normalized = normalizeMissionDAGDefinition(input.value, input.sourceLabel);
  const expectedDagId = computeMissionDAGId({
    rootMissionId: normalized.rootMissionId,
    nodes: normalized.nodes,
    edges: normalized.edges,
  });

  const dagId = typeof (input.value as { dagId?: unknown }).dagId === 'string'
    ? String((input.value as { dagId?: unknown }).dagId).trim()
    : '';

  const validated = validateMissionDAGDefinitionWithContext({
    value: input.value,
    sourceLabel: input.sourceLabel,
    knownMissionIds: input.knownMissionIds,
    dagId,
    expectedDagId,
  });

  return {
    dagId: expectedDagId,
    ...validated,
  };
}

export function loadMissionDAGDefinitions(options: {
  definitionsDir?: string;
  missionRegistry?: MissionRegistry;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
} = {}): MissionDAGDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_MISSION_DAG_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new Error(`MISSION_DAG_DEFINITIONS_NOT_FOUND: ${definitionsDir}`);
  }

  const missionRegistry = options.missionRegistry ?? createMissionRegistry({
    definitionsDir: options.missionDefinitionsDir,
    instancesDir: options.missionInstancesDir,
  });

  const knownMissionIds = missionRegistry.listMissionInstances().map((entry) => entry.missionId);

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  const loaded = files.map((fileName) => {
    const sourceValue = readJson(path.join(definitionsDir, fileName));
    const normalized = normalizeMissionDAGDefinition(sourceValue, fileName);
    const expectedDagId = computeMissionDAGId({
      rootMissionId: normalized.rootMissionId,
      nodes: normalized.nodes,
      edges: normalized.edges,
    });

    const dagId = typeof (sourceValue as { dagId?: unknown }).dagId === 'string'
      ? String((sourceValue as { dagId?: unknown }).dagId).trim()
      : '';

    const validated = validateMissionDAGDefinitionWithContext({
      value: sourceValue,
      sourceLabel: fileName,
      knownMissionIds,
      dagId,
      expectedDagId,
    });

    return {
      dagId: expectedDagId,
      ...validated,
    };
  });

  const seenDagIds = new Set<string>();
  for (const definition of loaded) {
    if (seenDagIds.has(definition.dagId)) {
      throw new Error(`MISSION_DAG_DUPLICATE_DEFINITION: ${definition.dagId}`);
    }
    seenDagIds.add(definition.dagId);
  }

  return loaded.sort((left, right) => left.dagId.localeCompare(right.dagId));
}

export function createMissionDAGRegistry(options: {
  definitionsDir?: string;
  missionRegistry?: MissionRegistry;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
} = {}) {
  const definitions = loadMissionDAGDefinitions(options);
  const byId = new Map<string, MissionDAGDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.dagId)) {
      throw new Error(`MISSION_DAG_DUPLICATE_DEFINITION: ${definition.dagId}`);
    }
    byId.set(definition.dagId, definition);
  }

  function listMissionDAGDefinitions(): MissionDAGDefinition[] {
    return Array.from(byId.values()).sort((left, right) => left.dagId.localeCompare(right.dagId));
  }

  function getMissionDAGDefinition(dagId: string): MissionDAGDefinition {
    const found = byId.get(dagId);
    if (!found) {
      throw new Error(`MISSION_DAG_NOT_FOUND: ${dagId}`);
    }
    return found;
  }

  return {
    listMissionDAGDefinitions,
    getMissionDAGDefinition,
  };
}

export type MissionDAGRegistry = ReturnType<typeof createMissionDAGRegistry>;
