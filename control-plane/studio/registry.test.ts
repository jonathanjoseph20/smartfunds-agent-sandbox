import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { loadOwnershipProjects } from './registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-canonical-registry');
const entitiesProjectsDir = path.join(tmpRoot, 'entities', 'projects');
const podsDir = path.join(tmpRoot, 'entities', 'pods');
const entityRegistryPath = path.join(tmpRoot, 'control-plane', 'entities', 'registry.json');
const fallbackProjectsDir = path.join(tmpRoot, 'control-plane', 'projects');

function resetTmpDirs(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(entitiesProjectsDir, { recursive: true });
  fs.mkdirSync(podsDir, { recursive: true });
  fs.mkdirSync(path.dirname(entityRegistryPath), { recursive: true });
  fs.mkdirSync(fallbackProjectsDir, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeEntityRegistry(entityIds = ['core-entity']): void {
  writeJson(
    entityRegistryPath,
    entityIds.map((entityId) => ({
      entityId,
      legalName: `${entityId} Legal`,
      projects: ['alpha-project'],
      complianceProfile: 'phase-1',
      custodyMode: 'managed'
    }))
  );
}

function writePod(id = 'smartfunds'): void {
  writeJson(path.join(podsDir, `${id}.json`), {
    id,
    name: id,
    mode: 'regulated',
    projects: [],
    teams: []
  });
}

function writeCanonicalProject(
  fileName: string,
  overrides: Partial<{
    id: string;
    name: string;
    entity: string;
    pod: string;
    mode: 'explore' | 'structured' | 'regulated';
    ownedPaths: string[];
    ownedFiles: string[];
  }> = {}
): void {
  writeJson(path.join(entitiesProjectsDir, fileName), {
    id: overrides.id ?? fileName.replace('.json', ''),
    name: overrides.name ?? 'Alpha Project',
    entity: overrides.entity ?? 'core-entity',
    pod: overrides.pod ?? 'smartfunds',
    mode: overrides.mode ?? 'structured',
    ownedPaths: overrides.ownedPaths ?? ['alpha/'],
    ownedFiles: overrides.ownedFiles ?? []
  });
}

function loadCanonicalProjects() {
  return loadOwnershipProjects({
    entitiesProjectsDir,
    fallbackProjectsDir,
    entityRegistryPath,
    podsDir
  });
}

beforeEach(() => {
  resetTmpDirs();
  writeEntityRegistry();
  writePod();
});

describe('canonical project registry loader', () => {
  it('loads canonical project specs successfully', () => {
    writeCanonicalProject('alpha-project.json');

    const projects = loadCanonicalProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].projectId).toBe('alpha-project');
    expect(projects[0].entityId).toBe('core-entity');
    expect(projects[0].podId).toBe('smartfunds');
    expect(projects[0].mode).toBe('structured');
    expect(projects[0].ownedPaths).toEqual(['alpha/**']);
  });

  it('loads projects in deterministic order', () => {
    writeCanonicalProject('b-project.json', { id: 'b-project', ownedPaths: ['b/'] });
    writeCanonicalProject('a-project.json', { id: 'a-project', ownedPaths: ['a/'] });

    const projects = loadCanonicalProjects();
    expect(projects.map((project) => project.projectId)).toEqual(['a-project', 'b-project']);
  });

  it('rejects duplicate project IDs', () => {
    writeCanonicalProject('one.json', { id: 'dup-project', ownedPaths: ['one/'] });
    writeCanonicalProject('two.json', { id: 'dup-project', ownedPaths: ['two/'] });

    expect(() => loadCanonicalProjects()).toThrow(/Duplicate projectId/);
  });

  it('rejects missing pod', () => {
    writeJson(path.join(entitiesProjectsDir, 'alpha.json'), {
      id: 'alpha-project',
      name: 'Alpha',
      entity: 'core-entity',
      mode: 'structured',
      ownedPaths: ['alpha/'],
      ownedFiles: []
    });

    expect(() => loadCanonicalProjects()).toThrow(/must include non-empty pod/);
  });

  it('rejects missing entity', () => {
    writeJson(path.join(entitiesProjectsDir, 'alpha.json'), {
      id: 'alpha-project',
      name: 'Alpha',
      pod: 'smartfunds',
      mode: 'structured',
      ownedPaths: ['alpha/'],
      ownedFiles: []
    });

    expect(() => loadCanonicalProjects()).toThrow(/must include non-empty entity/);
  });

  it('rejects invalid mode', () => {
    writeJson(path.join(entitiesProjectsDir, 'alpha.json'), {
      id: 'alpha-project',
      name: 'Alpha',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'build',
      ownedPaths: ['alpha/'],
      ownedFiles: []
    });

    expect(() => loadCanonicalProjects()).toThrow(/mode must be one of/);
  });

  it('rejects missing ownership arrays', () => {
    writeJson(path.join(entitiesProjectsDir, 'alpha.json'), {
      id: 'alpha-project',
      name: 'Alpha',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      ownedPaths: ['alpha/']
    });

    expect(() => loadCanonicalProjects()).toThrow(/ownedFiles must be a string array/);
  });

  it('rejects unknown entity references', () => {
    writeCanonicalProject('alpha.json', { entity: 'unknown-entity' });

    expect(() => loadCanonicalProjects()).toThrow(/unknown entity/);
  });

  it('rejects unknown pod references', () => {
    writeCanonicalProject('alpha.json', { pod: 'unknown-pod' });

    expect(() => loadCanonicalProjects()).toThrow(/unknown pod/);
  });

  it('rejects overlapping ownership definitions deterministically', () => {
    writeCanonicalProject('a.json', { id: 'a-project', ownedPaths: ['control-plane/'] });
    writeCanonicalProject('b.json', { id: 'b-project', ownedPaths: ['control-plane/cli/'] });

    expect(() => loadCanonicalProjects()).toThrow(
      'Project ownership overlap detected between a-project (control-plane/**) and b-project (control-plane/cli/**).'
    );
  });

  it('keeps canonical source authoritative when legacy fallback is present', () => {
    writeCanonicalProject('alpha-project.json', { id: 'alpha-project', ownedPaths: ['alpha/'] });
    writeJson(path.join(fallbackProjectsDir, 'legacy.json'), {
      projectId: 'legacy-project',
      ownedPaths: ['legacy/**']
    });

    const projects = loadCanonicalProjects();
    expect(projects.map((project) => project.projectId)).toEqual(['alpha-project']);
  });

  it('fails when canonical source is missing unless legacy fallback is explicitly enabled', () => {
    fs.rmSync(entitiesProjectsDir, { recursive: true, force: true });
    fs.mkdirSync(entitiesProjectsDir, { recursive: true });
    writeJson(path.join(fallbackProjectsDir, 'legacy.json'), {
      projectId: 'legacy-project',
      ownedPaths: ['legacy/**']
    });

    expect(() => loadCanonicalProjects()).toThrow(/No canonical project specs found/);

    const fallbackProjects = loadOwnershipProjects({
      entitiesProjectsDir,
      fallbackProjectsDir,
      allowLegacyFallback: true,
      entityRegistryPath,
      podsDir
    });
    expect(fallbackProjects.map((project) => project.projectId)).toEqual(['legacy-project']);
  });
});
