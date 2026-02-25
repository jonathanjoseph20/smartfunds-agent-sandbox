import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildEntityTelemetry,
  loadEntityRegistry,
  resolveEntityTelemetry
} from './entity-registry';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-entity-registry');
const projectsDir = path.join(tmpRoot, 'projects');
const registryPath = path.join(tmpRoot, 'entities.json');

function resetTmpDirs(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(projectsDir, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeProject(projectId: string): void {
  writeJson(path.join(projectsDir, `${projectId}.json`), {
    projectId,
    ownedPaths: [`${projectId}/**`]
  });
}

beforeEach(() => {
  resetTmpDirs();
});

describe('entity registry', () => {
  it('loads registry with deterministic mapping', () => {
    writeProject('project-a');
    writeProject('project-b');

    writeJson(registryPath, [
      {
        entityId: 'alpha-entity',
        legalName: 'Alpha Holdings',
        projects: ['project-a'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      },
      {
        entityId: 'beta-entity',
        legalName: 'Beta Holdings',
        projects: ['project-b'],
        complianceProfile: 'phase-1',
        custodyMode: 'escrow_based'
      }
    ]);

    const registry = loadEntityRegistry({ registryPath, projectsDir });
    expect(registry.entities.map((entity) => entity.entityId)).toEqual(['alpha-entity', 'beta-entity']);
    expect(registry.projectToEntity.get('project-a')).toBe('alpha-entity');
  });

  it('rejects duplicate entityId values', () => {
    writeProject('project-a');
    writeProject('project-b');

    writeJson(registryPath, [
      {
        entityId: 'dup-entity',
        legalName: 'Dup A',
        projects: ['project-a'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      },
      {
        entityId: 'dup-entity',
        legalName: 'Dup B',
        projects: ['project-b'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      }
    ]);

    expect(() => loadEntityRegistry({ registryPath, projectsDir })).toThrow(/Duplicate entityId/);
  });

  it('rejects duplicate project membership across entities', () => {
    writeProject('project-a');

    writeJson(registryPath, [
      {
        entityId: 'alpha-entity',
        legalName: 'Alpha Holdings',
        projects: ['project-a'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      },
      {
        entityId: 'beta-entity',
        legalName: 'Beta Holdings',
        projects: ['project-a'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      }
    ]);

    expect(() => loadEntityRegistry({ registryPath, projectsDir })).toThrow(/ProjectId appears in multiple entities/);
  });

  it('rejects unknown project references', () => {
    writeProject('project-a');

    writeJson(registryPath, [
      {
        entityId: 'alpha-entity',
        legalName: 'Alpha Holdings',
        projects: ['project-b'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      }
    ]);

    expect(() => loadEntityRegistry({ registryPath, projectsDir })).toThrow(
      /Unknown projectId referenced by entity alpha-entity: project-b/
    );
  });
});

describe('entity telemetry', () => {
  it('reports a single entity for a single project', () => {
    writeProject('project-a');
    writeJson(registryPath, [
      {
        entityId: 'alpha-entity',
        legalName: 'Alpha Holdings',
        projects: ['project-a'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      }
    ]);

    const registry = loadEntityRegistry({ registryPath, projectsDir });
    const telemetry = buildEntityTelemetry(['project-a'], registry);

    expect(telemetry.entitiesTouched).toEqual(['alpha-entity']);
    expect(telemetry.entityOwnershipStatus).toBe('ok');
    expect(telemetry.unmappedProjects).toEqual([]);
    expect(telemetry.entityByProject).toEqual({ 'project-a': 'alpha-entity' });
  });

  it('reports multi-entity ownership when projects span entities', () => {
    writeProject('project-a');
    writeProject('project-b');
    writeJson(registryPath, [
      {
        entityId: 'alpha-entity',
        legalName: 'Alpha Holdings',
        projects: ['project-a'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      },
      {
        entityId: 'beta-entity',
        legalName: 'Beta Holdings',
        projects: ['project-b'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      }
    ]);

    const registry = loadEntityRegistry({ registryPath, projectsDir });
    const telemetry = buildEntityTelemetry(['project-b', 'project-a'], registry);

    expect(telemetry.entitiesTouched).toEqual(['alpha-entity', 'beta-entity']);
    expect(telemetry.entityOwnershipStatus).toBe('multi_entity');
    expect(Object.keys(telemetry.entityByProject)).toEqual(['project-a', 'project-b']);
  });

  it('reports unmapped projects deterministically', () => {
    writeProject('project-a');
    writeJson(registryPath, [
      {
        entityId: 'alpha-entity',
        legalName: 'Alpha Holdings',
        projects: ['project-a'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      }
    ]);

    const registry = loadEntityRegistry({ registryPath, projectsDir });
    const telemetry = buildEntityTelemetry(['project-a', 'project-z'], registry);

    expect(telemetry.entityOwnershipStatus).toBe('unknown_entity_mapping');
    expect(telemetry.unmappedProjects).toEqual(['project-z']);
    expect(telemetry.entityByProject).toEqual({ 'project-a': 'alpha-entity', 'project-z': null });
  });

  it('provides next actions on unknown mappings', () => {
    writeProject('project-a');
    writeJson(registryPath, [
      {
        entityId: 'alpha-entity',
        legalName: 'Alpha Holdings',
        projects: ['project-a'],
        complianceProfile: 'phase-1',
        custodyMode: 'managed'
      }
    ]);

    const result = resolveEntityTelemetry(['project-a', 'project-z'], { registryPath, projectsDir });
    expect(result.telemetry.entityOwnershipStatus).toBe('unknown_entity_mapping');
    expect(result.nextActions.join('\n')).toContain('Add missing projectId to control-plane/entities/registry.json.');
  });
});
