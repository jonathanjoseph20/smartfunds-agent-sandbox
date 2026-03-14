import fs from 'node:fs';
import path from 'node:path';

export type Organization = {
  id: string;
  name: string;
  pods: string[];
  created: 'static';
};

export type PodMode = 'regulated' | 'build' | 'explore';

export type Pod = {
  id: string;
  name: string;
  mode: PodMode;
  projects: string[];
  teams: string[];
  financeScope: string;
};

export type Project = {
  id: string;
  pod: string;
  ownedPaths: string[];
};

export type Team = {
  id: string;
  pod: string;
  responsibility: string;
  permissions: string[];
};

export type Agent = {
  id: string;
  team: string;
  model: string;
  capabilities: string[];
};

export type FinanceScope = {
  scope: string;
  rails: string[];
  limits: {
    maxCharge: number;
  };
};

export type EntityRegistry = {
  organizations: Record<string, Organization>;
  pods: Record<string, Pod>;
  projects: Record<string, Project>;
  teams: Record<string, Team>;
  agents: Record<string, Agent>;
  financeScopes: Record<string, FinanceScope>;
};

export type ValidationResult = {
  ok: true;
};

type RegistryKind = 'organizations' | 'pods' | 'projects' | 'teams' | 'agents' | 'finance';

const REGISTRY_KINDS: RegistryKind[] = ['organizations', 'pods', 'projects', 'teams', 'agents', 'finance'];
const ALLOWED_REGULATED_RAILS = ['stripe', 'wire', 'usdc'];

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function ensureObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function ensureNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  if (!value.every((item) => typeof item === 'string' && item.trim().length > 0)) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  return [...value].sort((a, b) => a.localeCompare(b));
}

function ensurePodMode(value: unknown, label: string): PodMode {
  if (value !== 'regulated' && value !== 'build' && value !== 'explore') {
    throw new Error(`${label} must be one of regulated, build, explore.`);
  }
  return value;
}

function ensureOwnedPaths(value: unknown, label: string): string[] {
  const ownedPaths = ensureStringArray(value, label);
  for (const ownedPath of ownedPaths) {
    if (!ownedPath.endsWith('/')) {
      throw new Error(`${label} entries must end with '/': ${ownedPath}`);
    }
  }
 return ownedPaths;
}

function ensureRails(value: unknown, label: string): string[] {
  const rails = ensureStringArray(value, label);
  return sortedUnique(rails);
}

function ensureMaxCharge(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return value;
}

function parseJsonFile(filePath: string, displayPath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : 'Invalid JSON';
    throw new Error(`Invalid JSON in ${displayPath}: ${message}`);
  }
}

function listJsonFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs
    .readdirSync(dirPath)
    .filter((entry) => entry.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
}

function parseOrganization(raw: unknown, displayPath: string): Organization {
  const data = ensureObject(raw, `Organization ${displayPath}`);
  const organization: Organization = {
    id: ensureNonEmptyString(data.id, `Organization ${displayPath} id`),
    name: ensureNonEmptyString(data.name, `Organization ${displayPath} name`),
    pods: ensureStringArray(data.pods, `Organization ${displayPath} pods`),
    created: data.created === 'static' ? 'static' : (() => {
      throw new Error(`Organization ${displayPath} created must be 'static'.`);
    })()
  };
  return organization;
}

function parsePod(raw: unknown, displayPath: string): Pod {
  const data = ensureObject(raw, `Pod ${displayPath}`);
  return {
    id: ensureNonEmptyString(data.id, `Pod ${displayPath} id`),
    name: ensureNonEmptyString(data.name, `Pod ${displayPath} name`),
    mode: ensurePodMode(data.mode, `Pod ${displayPath} mode`),
    projects: ensureStringArray(data.projects, `Pod ${displayPath} projects`),
    teams: ensureStringArray(data.teams, `Pod ${displayPath} teams`),
    financeScope: ensureNonEmptyString(data.financeScope, `Pod ${displayPath} financeScope`)
  };
}

function parseProject(raw: unknown, displayPath: string): Project {
  const data = ensureObject(raw, `Project ${displayPath}`);
  return {
    id: ensureNonEmptyString(data.id, `Project ${displayPath} id`),
    pod: ensureNonEmptyString(data.pod, `Project ${displayPath} pod`),
    ownedPaths: ensureOwnedPaths(data.ownedPaths, `Project ${displayPath} ownedPaths`)
  };
}

function parseTeam(raw: unknown, displayPath: string): Team {
  const data = ensureObject(raw, `Team ${displayPath}`);
  return {
    id: ensureNonEmptyString(data.id, `Team ${displayPath} id`),
    pod: ensureNonEmptyString(data.pod, `Team ${displayPath} pod`),
    responsibility: ensureNonEmptyString(data.responsibility, `Team ${displayPath} responsibility`),
    permissions: ensureStringArray(data.permissions, `Team ${displayPath} permissions`)
  };
}

function parseAgent(raw: unknown, displayPath: string): Agent {
  const data = ensureObject(raw, `Agent ${displayPath}`);
  return {
    id: ensureNonEmptyString(data.id, `Agent ${displayPath} id`),
    team: ensureNonEmptyString(data.team, `Agent ${displayPath} team`),
    model: ensureNonEmptyString(data.model, `Agent ${displayPath} model`),
    capabilities: ensureStringArray(data.capabilities, `Agent ${displayPath} capabilities`)
  };
}

function parseFinanceScope(raw: unknown, displayPath: string): FinanceScope {
  const data = ensureObject(raw, `Finance ${displayPath}`);
  const limits = ensureObject(data.limits, `Finance ${displayPath} limits`);
  return {
    scope: ensureNonEmptyString(data.scope, `Finance ${displayPath} scope`),
    rails: ensureRails(data.rails, `Finance ${displayPath} rails`),
    limits: {
      maxCharge: ensureMaxCharge(limits.maxCharge, `Finance ${displayPath} limits.maxCharge`)
    }
  };
}

function buildSortedRecord<T extends { [key: string]: unknown }>(
  entries: Array<{ key: string; value: T }>
): Record<string, T> {
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key));
  const record: Record<string, T> = {};
  for (const entry of sorted) {
    record[entry.key] = entry.value;
  }
  return record;
}

function assertNoDuplicateIds(kind: RegistryKind, ids: string[]): void {
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const unique = sortedUnique(duplicateIds);
  if (unique.length > 0) {
    throw new Error(`Duplicate ${kind} id: ${unique.join(', ')}`);
  }
}

function assertNoGlobalIdCollisions(reg: EntityRegistry): void {
  const globalMap = new Map<string, string>();
  const check = (kind: string, id: string): void => {
    const existing = globalMap.get(id);
    if (existing && existing !== kind) {
      throw new Error(`Global ID collision: ${id} in ${existing} and ${kind}`);
    }
    globalMap.set(id, kind);
  };

  for (const id of Object.keys(reg.organizations)) check('organizations', id);
  for (const id of Object.keys(reg.pods)) check('pods', id);
  for (const id of Object.keys(reg.projects)) check('projects', id);
  for (const id of Object.keys(reg.teams)) check('teams', id);
  for (const id of Object.keys(reg.agents)) check('agents', id);
}

function pathsOverlap(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

export function validateEntityRegistry(reg: EntityRegistry): ValidationResult {
  assertNoGlobalIdCollisions(reg);

  for (const organization of Object.values(reg.organizations)) {
    for (const podId of organization.pods) {
      if (!reg.pods[podId]) {
        throw new Error(`Organization ${organization.id} references unknown pod ${podId}`);
      }
    }
  }

  for (const pod of Object.values(reg.pods)) {
    if (!reg.financeScopes[pod.financeScope]) {
      throw new Error(`Pod ${pod.id} references unknown finance scope ${pod.financeScope}`);
    }
    for (const projectId of pod.projects) {
      const project = reg.projects[projectId];
      if (!project) {
        throw new Error(`Pod ${pod.id} references unknown project ${projectId}`);
      }
      if (project.pod !== pod.id) {
        throw new Error(`Project ${project.id} pod ${project.pod} does not match pod ${pod.id}`);
      }
    }
    for (const teamId of pod.teams) {
      const team = reg.teams[teamId];
      if (!team) {
        throw new Error(`Pod ${pod.id} references unknown team ${teamId}`);
      }
      if (team.pod !== pod.id) {
        throw new Error(`Team ${team.id} pod ${team.pod} does not match pod ${pod.id}`);
      }
    }

    const finance = reg.financeScopes[pod.financeScope];
    if (!finance.rails || finance.rails.length === 0) {
      throw new Error(`Finance scope ${pod.financeScope} must declare rails`);
    }

    if (pod.mode === 'regulated') {
      for (const rail of finance.rails) {
        if (!ALLOWED_REGULATED_RAILS.includes(rail)) {
          throw new Error(`Regulated pod ${pod.id} has disallowed rail ${rail}`);
        }
      }
      if (typeof finance.limits.maxCharge !== 'number') {
        throw new Error(`Regulated pod ${pod.id} requires finance maxCharge`);
      }
    }
  }

  for (const agent of Object.values(reg.agents)) {
    if (!reg.teams[agent.team]) {
      throw new Error(`Agent ${agent.id} references unknown team ${agent.team}`);
    }
  }

  const projectEntries = Object.values(reg.projects).sort((a, b) => a.id.localeCompare(b.id));

  for (const project of projectEntries) {
    if (!project.ownedPaths || project.ownedPaths.length === 0) {
      throw new Error(`Project ${project.id} must define non-empty ownedPaths`);
    }
    for (const ownedPath of project.ownedPaths) {
      if (!ownedPath.endsWith('/')) {
        throw new Error(`Project ${project.id} ownedPath ${ownedPath} must end with '/'`);
      }
    }
  }

  for (let i = 0; i < projectEntries.length; i += 1) {
    for (let j = i + 1; j < projectEntries.length; j += 1) {
      const left = projectEntries[i];
      const right = projectEntries[j];
      for (const leftPath of left.ownedPaths) {
        for (const rightPath of right.ownedPaths) {
          if (pathsOverlap(leftPath, rightPath)) {
            throw new Error(
              `Owned path overlap detected: ${left.id}:${leftPath} and ${right.id}:${rightPath}`
            );
          }
        }
      }
    }
  }

  return { ok: true };
}

export function loadEntityRegistry(repoRoot = process.cwd()): EntityRegistry {
  const entitiesRoot = path.join(repoRoot, 'entities');

  const organizationsLoaded: Organization[] = [];
  const podsLoaded: Pod[] = [];
  const projectsLoaded: Project[] = [];
  const teamsLoaded: Team[] = [];
  const agentsLoaded: Agent[] = [];
  const financeLoaded: FinanceScope[] = [];

  for (const kind of REGISTRY_KINDS) {
    const kindDir = path.join(entitiesRoot, kind);
    const files = listJsonFiles(kindDir);
    for (const file of files) {
      const absolutePath = path.join(kindDir, file);
      const relativePath = path.posix.join('entities', kind, file);
      const raw = parseJsonFile(absolutePath, relativePath);

      if (kind === 'organizations') organizationsLoaded.push(parseOrganization(raw, relativePath));
      if (kind === 'pods') podsLoaded.push(parsePod(raw, relativePath));
      if (kind === 'projects') projectsLoaded.push(parseProject(raw, relativePath));
      if (kind === 'teams') teamsLoaded.push(parseTeam(raw, relativePath));
      if (kind === 'agents') agentsLoaded.push(parseAgent(raw, relativePath));
      if (kind === 'finance') financeLoaded.push(parseFinanceScope(raw, relativePath));
    }
  }

  assertNoDuplicateIds('organizations', organizationsLoaded.map((item) => item.id));
  assertNoDuplicateIds('pods', podsLoaded.map((item) => item.id));
  assertNoDuplicateIds('projects', projectsLoaded.map((item) => item.id));
  assertNoDuplicateIds('teams', teamsLoaded.map((item) => item.id));
  assertNoDuplicateIds('agents', agentsLoaded.map((item) => item.id));
  assertNoDuplicateIds('finance', financeLoaded.map((item) => item.scope));

  const registry: EntityRegistry = {
    organizations: buildSortedRecord(organizationsLoaded.map((entry) => ({ key: entry.id, value: entry }))),
    pods: buildSortedRecord(podsLoaded.map((entry) => ({ key: entry.id, value: entry }))),
    projects: buildSortedRecord(projectsLoaded.map((entry) => ({ key: entry.id, value: entry }))),
    teams: buildSortedRecord(teamsLoaded.map((entry) => ({ key: entry.id, value: entry }))),
    agents: buildSortedRecord(agentsLoaded.map((entry) => ({ key: entry.id, value: entry }))),
    financeScopes: buildSortedRecord(financeLoaded.map((entry) => ({ key: entry.scope, value: entry })))
  };

  validateEntityRegistry(registry);
  return registry;
}

export function buildEntityRegistryReport(reg: EntityRegistry): string {
  return [
    'Entity Registry Loaded',
    '',
    `Organizations: ${Object.keys(reg.organizations).length}`,
    `Pods: ${Object.keys(reg.pods).length}`,
    `Projects: ${Object.keys(reg.projects).length}`,
    `Teams: ${Object.keys(reg.teams).length}`,
    `Agents: ${Object.keys(reg.agents).length}`,
    `FinanceScopes: ${Object.keys(reg.financeScopes).length}`,
    '',
    'Validation: OK'
  ].join('\n');
}

function runCli(argv: string[]): number {
  if (!argv.includes('--validate')) {
    return 0;
  }

  try {
    const registry = loadEntityRegistry('.');
    process.stdout.write(`${buildEntityRegistryReport(registry)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    process.stdout.write('Entity Registry Validation Failed\n');
    process.stdout.write(`Error: ${message}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = runCli(process.argv.slice(2));
  process.exit(exitCode);
}
