import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildEntityRegistryReport, loadEntityRegistry } from './entity-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-runtime-entity-registry');

function resetTmp(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
}

function mkdirp(relativeDir: string): void {
  fs.mkdirSync(path.join(tmpRoot, relativeDir), { recursive: true });
}

function writeJson(relativePath: string, value: unknown): void {
  const filePath = path.join(tmpRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeValidSeed(): void {
  mkdirp('entities/organizations');
  mkdirp('entities/pods');
  mkdirp('entities/projects');
  mkdirp('entities/teams');
  mkdirp('entities/agents');
  mkdirp('entities/finance');

  writeJson('entities/organizations/org.json', {
    created: 'static',
    id: 'org',
    name: 'Org',
    pods: ['pod-a', 'pod-b']
  });

  writeJson('entities/pods/pod-a.json', {
    financeScope: 'scope-a',
    id: 'pod-a',
    mode: 'regulated',
    name: 'Pod A',
    projects: ['project-a'],
    teams: ['team-a']
  });

  writeJson('entities/pods/pod-b.json', {
    financeScope: 'scope-b',
    id: 'pod-b',
    mode: 'build',
    name: 'Pod B',
    projects: ['project-b'],
    teams: ['team-b']
  });

  writeJson('entities/projects/project-a.json', {
    id: 'project-a',
    ownedPaths: ['apps/a/'],
    pod: 'pod-a'
  });

  writeJson('entities/projects/project-b.json', {
    id: 'project-b',
    ownedPaths: ['apps/b/'],
    pod: 'pod-b'
  });

  writeJson('entities/teams/team-a.json', {
    id: 'team-a',
    permissions: ['approve'],
    pod: 'pod-a',
    responsibility: 'A'
  });

  writeJson('entities/teams/team-b.json', {
    id: 'team-b',
    permissions: ['build'],
    pod: 'pod-b',
    responsibility: 'B'
  });

  writeJson('entities/agents/agent-a.json', {
    capabilities: ['x'],
    id: 'agent-a',
    model: 'gpt-5',
    team: 'team-a'
  });

  writeJson('entities/agents/agent-b.json', {
    capabilities: ['y'],
    id: 'agent-b',
    model: 'gpt-5',
    team: 'team-b'
  });

  writeJson('entities/finance/scope-a.json', {
    limits: { maxCharge: 10 },
    rails: ['wire', 'usdc', 'stripe'],
    scope: 'scope-a'
  });

  writeJson('entities/finance/scope-b.json', {
    limits: { maxCharge: 10 },
    rails: ['stripe'],
    scope: 'scope-b'
  });
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runtime entity registry', () => {
  it('fails on duplicate IDs within a type', () => {
    resetTmp();
    writeValidSeed();
    writeJson('entities/pods/dup-2.json', {
      financeScope: 'scope-b',
      id: 'pod-a',
      mode: 'build',
      name: 'Duplicate Pod A',
      projects: ['project-b'],
      teams: ['team-b']
    });

    expect(() => loadEntityRegistry(tmpRoot)).toThrow('Duplicate pods id: pod-a');
  });

  it('fails when pod references missing project', () => {
    resetTmp();
    writeValidSeed();
    writeJson('entities/pods/pod-a.json', {
      financeScope: 'scope-a',
      id: 'pod-a',
      mode: 'regulated',
      name: 'Pod A',
      projects: ['missing-project'],
      teams: ['team-a']
    });

    expect(() => loadEntityRegistry(tmpRoot)).toThrow('Pod pod-a references unknown project missing-project');
  });

  it('fails on ownedPath overlap across pods', () => {
    resetTmp();
    writeValidSeed();
    writeJson('entities/projects/project-b.json', {
      id: 'project-b',
      ownedPaths: ['apps/a/sub/'],
      pod: 'pod-b'
    });

    expect(() => loadEntityRegistry(tmpRoot)).toThrow(
      'Owned path overlap detected: project-a:apps/a/ and project-b:apps/a/sub/'
    );
  });

  it('fails when agent references missing team', () => {
    resetTmp();
    writeValidSeed();
    writeJson('entities/agents/agent-a.json', {
      capabilities: ['x'],
      id: 'agent-a',
      model: 'gpt-5',
      team: 'missing-team'
    });

    expect(() => loadEntityRegistry(tmpRoot)).toThrow('Agent agent-a references unknown team missing-team');
  });

  it('builds deterministic report ordering', () => {
    resetTmp();
    writeValidSeed();

    const registry = loadEntityRegistry(tmpRoot);
    const report = buildEntityRegistryReport(registry);

    expect(report).toBe(
      [
        'Entity Registry Loaded',
        '',
        'Organizations: 1',
        'Pods: 2',
        'Projects: 2',
        'Teams: 2',
        'Agents: 2',
        'FinanceScopes: 2',
        '',
        'Validation: OK'
      ].join('\n')
    );
  });

  it('loads sorted ids deterministically from unsorted filenames', () => {
    resetTmp();
    writeValidSeed();

    fs.renameSync(
      path.join(tmpRoot, 'entities/projects/project-a.json'),
      path.join(tmpRoot, 'entities/projects/z-project-a.json')
    );
    fs.renameSync(
      path.join(tmpRoot, 'entities/projects/project-b.json'),
      path.join(tmpRoot, 'entities/projects/a-project-b.json')
    );

    const registry = loadEntityRegistry(tmpRoot);
    expect(Object.keys(registry.projects)).toEqual(['project-a', 'project-b']);
  });
});
