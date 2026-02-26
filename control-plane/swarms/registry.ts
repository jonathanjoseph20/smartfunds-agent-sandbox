import fs from 'node:fs';
import path from 'node:path';

import type { Project } from '../studio/registry.ts';
import type { ExecutionMode, SwarmDefinition, SwarmMember } from './types.ts';

const EXECUTION_MODES: ExecutionMode[] = ['structured', 'autonomous'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (!isStringArray(value)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return value;
}

function assertExecutionMode(value: unknown, label: string): asserts value is ExecutionMode {
  if (!EXECUTION_MODES.includes(value as ExecutionMode)) {
    throw new Error(`${label} must be one of ${EXECUTION_MODES.join(', ')}.`);
  }
}

function loadJsonFiles<T>(dir: string): Array<{ file: string; data: T }> {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir).filter((entry) => entry.endsWith('.json')).sort((a, b) => a.localeCompare(b));
  return entries.map((entry) => {
    const filePath = path.join(dir, entry);
    const raw = fs.readFileSync(filePath, 'utf8');
    return { file: entry, data: JSON.parse(raw) as T };
  });
}

function parseMembers(value: unknown, swarmId: string): SwarmMember[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`Swarm ${swarmId} members must be an array.`);
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Swarm ${swarmId} member ${index} must be an object.`);
    }
    const data = entry as Record<string, unknown>;
    assertNonEmptyString(data.role, `Swarm ${swarmId} member ${index} role`);
    const capabilities = data.capabilities === undefined
      ? undefined
      : ensureStringArray(data.capabilities, `Swarm ${swarmId} member ${index} capabilities`);

    return {
      role: data.role,
      capabilities
    } satisfies SwarmMember;
  });
}

function assertUniqueSwarmIds(swarms: SwarmDefinition[]): void {
  const ids = swarms.map((swarm) => swarm.swarmId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    const unique = Array.from(new Set(duplicates)).sort((a, b) => a.localeCompare(b));
    throw new Error(`Duplicate swarmId detected: ${unique.join(', ')}.`);
  }
}

function assertParentSwarmsValid(swarms: SwarmDefinition[]): void {
  const swarmMap = new Map(swarms.map((swarm) => [swarm.swarmId, swarm]));
  const sorted = [...swarms].sort((a, b) => a.swarmId.localeCompare(b.swarmId));

  for (const swarm of sorted) {
    if (!swarm.parentSwarm) {
      continue;
    }
    if (swarm.parentSwarm === swarm.swarmId) {
      throw new Error(`Swarm ${swarm.swarmId} parentSwarm cannot reference itself.`);
    }
    const parent = swarmMap.get(swarm.parentSwarm);
    if (!parent) {
      throw new Error(`Swarm ${swarm.swarmId} references unknown parentSwarm ${swarm.parentSwarm}.`);
    }
    if (parent.project !== swarm.project) {
      throw new Error(
        `Swarm ${swarm.swarmId} parentSwarm ${swarm.parentSwarm} must share project ${swarm.project}.`
      );
    }
  }
}

function assertNoParentCycles(swarms: SwarmDefinition[]): void {
  const swarmMap = new Map(swarms.map((swarm) => [swarm.swarmId, swarm]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const sortedIds = [...swarmMap.keys()].sort((a, b) => a.localeCompare(b));

  const visit = (swarmId: string, stack: string[]): void => {
    if (visited.has(swarmId)) {
      return;
    }
    if (visiting.has(swarmId)) {
      const cycleStart = stack.indexOf(swarmId);
      const cycle = stack.slice(cycleStart).concat(swarmId);
      throw new Error(`Swarm parent cycle detected: ${cycle.join(' -> ')}`);
    }

    visiting.add(swarmId);
    const swarm = swarmMap.get(swarmId);
    if (swarm?.parentSwarm) {
      visit(swarm.parentSwarm, [...stack, swarmId]);
    }
    visiting.delete(swarmId);
    visited.add(swarmId);
  };

  for (const swarmId of sortedIds) {
    visit(swarmId, []);
  }
}

export function loadSwarmsFromDir(dir: string, projects: Project[]): SwarmDefinition[] {
  const projectIds = new Set(projects.map((project) => project.projectId));

  const loaded = loadJsonFiles<Record<string, unknown>>(dir).map(({ file, data }) => {
    if (!data || typeof data !== 'object') {
      throw new Error(`Swarm ${file} must be an object.`);
    }
    const record = data as Record<string, unknown>;
    assertNonEmptyString(record.swarmId, `Swarm ${file} swarmId`);
    assertNonEmptyString(record.project, `Swarm ${record.swarmId} project`);
    assertNonEmptyString(record.team, `Swarm ${record.swarmId} team`);
    assertExecutionMode(record.executionMode, `Swarm ${record.swarmId} executionMode`);

    if (!projectIds.has(record.project)) {
      throw new Error(
        `Swarm ${record.swarmId} references unregistered project ${record.project}. Register project first.`
      );
    }

    let parentSwarm: string | undefined;
    if (record.parentSwarm !== undefined) {
      assertNonEmptyString(record.parentSwarm, `Swarm ${record.swarmId} parentSwarm`);
      parentSwarm = record.parentSwarm;
    }

    const members = parseMembers(record.members, record.swarmId);

    const swarm: SwarmDefinition = {
      swarmId: record.swarmId,
      project: record.project,
      team: record.team,
      executionMode: record.executionMode,
      parentSwarm,
      members
    };
    return swarm;
  });

  assertUniqueSwarmIds(loaded);
  assertParentSwarmsValid(loaded);
  assertNoParentCycles(loaded);

  return [...loaded].sort((a, b) => a.swarmId.localeCompare(b.swarmId));
}
