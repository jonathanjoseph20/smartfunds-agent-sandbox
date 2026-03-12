import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../../finance/determinism.ts';

import type { MissionProposalDefinition } from './mission-proposal-definition-types.ts';
import type { MissionProposalInstance } from './mission-proposal-types.ts';
import {
  validateMissionProposalDefinition,
  validateMissionProposalDefinitionLinkage,
  validateMissionProposalInstance,
} from './mission-proposal-validator.ts';

export const DEFAULT_MISSION_PROPOSAL_DEFINITIONS_DIR = 'control-plane/missions/proposals/definitions';
export const DEFAULT_MISSION_PROPOSAL_INSTANCES_DIR = 'control-plane/missions/proposals/instances';

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

export function loadMissionProposalDefinitions(options: {
  definitionsDir?: string;
  missionTemplateDefinitionsDir?: string;
  missionDefinitionsDir?: string;
} = {}): MissionProposalDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_MISSION_PROPOSAL_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new Error(`MISSION_PROPOSAL_DEFINITIONS_NOT_FOUND: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  const definitions = files
    .map((entry) => validateMissionProposalDefinition(readJson(path.join(definitionsDir, entry)), entry))
    .sort((left, right) => left.proposalType.localeCompare(right.proposalType));

  for (const definition of definitions) {
    validateMissionProposalDefinitionLinkage({
      definition,
      missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
      missionDefinitionsDir: options.missionDefinitionsDir,
    });
  }

  return definitions;
}

export function loadMissionProposalInstances(options: {
  instancesDir?: string;
  missionTemplateDefinitionsDir?: string;
  missionDefinitionsDir?: string;
} = {}): MissionProposalInstance[] {
  const instancesDir = path.resolve(options.instancesDir ?? DEFAULT_MISSION_PROPOSAL_INSTANCES_DIR);
  if (!fs.existsSync(instancesDir)) {
    return [];
  }

  const files = fs.readdirSync(instancesDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => validateMissionProposalInstance(readJson(path.join(instancesDir, entry)), entry, {
      missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
      missionDefinitionsDir: options.missionDefinitionsDir,
    }))
    .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
}

function resolveInstancesDir(instancesDir?: string): string {
  return path.resolve(instancesDir ?? DEFAULT_MISSION_PROPOSAL_INSTANCES_DIR);
}

export function writeMissionProposalInstance(instance: MissionProposalInstance, options: { instancesDir?: string } = {}): string {
  const instancesDir = resolveInstancesDir(options.instancesDir);
  fs.mkdirSync(instancesDir, { recursive: true });
  const filePath = path.join(instancesDir, `${instance.proposalId}.json`);
  fs.writeFileSync(filePath, `${canonicalStringify(instance)}\n`, 'utf8');
  return filePath;
}

export function createMissionProposalRegistry(options: {
  definitionsDir?: string;
  instancesDir?: string;
  missionTemplateDefinitionsDir?: string;
  missionDefinitionsDir?: string;
} = {}) {
  const definitions = loadMissionProposalDefinitions({
    definitionsDir: options.definitionsDir,
    missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
  });

  const instances = loadMissionProposalInstances({
    instancesDir: options.instancesDir,
    missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
  });

  const definitionByType = new Map<string, MissionProposalDefinition>();
  for (const definition of definitions) {
    if (definitionByType.has(definition.proposalType)) {
      throw new Error(`MISSION_PROPOSAL_DUPLICATE_DEFINITION: ${definition.proposalType}`);
    }
    definitionByType.set(definition.proposalType, definition);
  }

  const instanceById = new Map<string, MissionProposalInstance>();
  for (const instance of instances) {
    if (instanceById.has(instance.proposalId)) {
      throw new Error(`MISSION_PROPOSAL_DUPLICATE_INSTANCE: ${instance.proposalId}`);
    }
    instanceById.set(instance.proposalId, instance);
  }

  function listProposalDefinitions(): MissionProposalDefinition[] {
    return Array.from(definitionByType.values())
      .sort((left, right) => left.proposalType.localeCompare(right.proposalType));
  }

  function listProposalInstances(): MissionProposalInstance[] {
    return Array.from(instanceById.values())
      .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
  }

  function getProposalDefinition(proposalType: string): MissionProposalDefinition {
    const found = definitionByType.get(proposalType);
    if (!found) {
      throw new Error(`MISSION_PROPOSAL_DEFINITION_NOT_FOUND: ${proposalType}`);
    }
    return found;
  }

  function getProposalInstance(proposalId: string): MissionProposalInstance {
    const found = instanceById.get(proposalId);
    if (!found) {
      throw new Error(`MISSION_PROPOSAL_NOT_FOUND: ${proposalId}`);
    }
    return found;
  }

  function saveProposalInstance(instance: MissionProposalInstance): string {
    const validated = validateMissionProposalInstance(instance, '<save>', {
      missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
      missionDefinitionsDir: options.missionDefinitionsDir,
    });
    const filePath = writeMissionProposalInstance(validated, { instancesDir: options.instancesDir });
    instanceById.set(validated.proposalId, validated);
    return filePath;
  }

  return {
    listProposalDefinitions,
    listProposalInstances,
    getProposalDefinition,
    getProposalInstance,
    saveProposalInstance,
  };
}

export type MissionProposalRegistry = ReturnType<typeof createMissionProposalRegistry>;
