import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadProjectsFromDir } from '../studio/registry.ts';
import { loadSwarmsFromDir } from './registry.ts';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'swarms-'));
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('swarms registry', () => {
  it('loads valid swarms with parent linkage', () => {
    const root = makeTempDir();
    const projectsDir = path.join(root, 'projects');
    const swarmsDir = path.join(root, 'swarms');
    fs.mkdirSync(projectsDir, { recursive: true });
    fs.mkdirSync(swarmsDir, { recursive: true });

    writeJson(path.join(projectsDir, 'docs.json'), { projectId: 'docs', ownedPaths: ['docs/**'] });

    writeJson(path.join(swarmsDir, 'executive.json'), {
      swarmId: 'executive-team',
      project: 'docs',
      team: 'docs',
      executionMode: 'structured'
    });

    writeJson(path.join(swarmsDir, 'dev.json'), {
      swarmId: 'dev-team',
      project: 'docs',
      team: 'docs',
      executionMode: 'structured',
      parentSwarm: 'executive-team',
      members: [{ role: 'planner', capabilities: ['plan'] }]
    });

    const projects = loadProjectsFromDir(projectsDir);
    const swarms = loadSwarmsFromDir(swarmsDir, projects);

    expect(swarms.map((swarm) => swarm.swarmId)).toEqual(['dev-team', 'executive-team']);
    expect(swarms.find((swarm) => swarm.swarmId === 'dev-team')?.parentSwarm).toBe('executive-team');
  });

  it('rejects duplicate swarmId entries', () => {
    const root = makeTempDir();
    const projectsDir = path.join(root, 'projects');
    const swarmsDir = path.join(root, 'swarms');
    fs.mkdirSync(projectsDir, { recursive: true });
    fs.mkdirSync(swarmsDir, { recursive: true });

    writeJson(path.join(projectsDir, 'docs.json'), { projectId: 'docs', ownedPaths: ['docs/**'] });
    writeJson(path.join(swarmsDir, 'one.json'), {
      swarmId: 'dup',
      project: 'docs',
      team: 'docs',
      executionMode: 'structured'
    });
    writeJson(path.join(swarmsDir, 'two.json'), {
      swarmId: 'dup',
      project: 'docs',
      team: 'docs',
      executionMode: 'structured'
    });

    const projects = loadProjectsFromDir(projectsDir);
    expect(() => loadSwarmsFromDir(swarmsDir, projects)).toThrow(/Duplicate swarmId detected/);
  });

  it('rejects swarms that reference unknown projects', () => {
    const root = makeTempDir();
    const projectsDir = path.join(root, 'projects');
    const swarmsDir = path.join(root, 'swarms');
    fs.mkdirSync(projectsDir, { recursive: true });
    fs.mkdirSync(swarmsDir, { recursive: true });

    writeJson(path.join(projectsDir, 'docs.json'), { projectId: 'docs', ownedPaths: ['docs/**'] });
    writeJson(path.join(swarmsDir, 'unknown.json'), {
      swarmId: 'unknown',
      project: 'missing',
      team: 'docs',
      executionMode: 'structured'
    });

    const projects = loadProjectsFromDir(projectsDir);
    expect(() => loadSwarmsFromDir(swarmsDir, projects)).toThrow(/Register project first/);
  });

  it('rejects missing parentSwarm references', () => {
    const root = makeTempDir();
    const projectsDir = path.join(root, 'projects');
    const swarmsDir = path.join(root, 'swarms');
    fs.mkdirSync(projectsDir, { recursive: true });
    fs.mkdirSync(swarmsDir, { recursive: true });

    writeJson(path.join(projectsDir, 'docs.json'), { projectId: 'docs', ownedPaths: ['docs/**'] });
    writeJson(path.join(swarmsDir, 'dev.json'), {
      swarmId: 'dev-team',
      project: 'docs',
      team: 'docs',
      executionMode: 'structured',
      parentSwarm: 'missing-parent'
    });

    const projects = loadProjectsFromDir(projectsDir);
    expect(() => loadSwarmsFromDir(swarmsDir, projects)).toThrow(/unknown parentSwarm/);
  });

  it('rejects parent swarms from different projects', () => {
    const root = makeTempDir();
    const projectsDir = path.join(root, 'projects');
    const swarmsDir = path.join(root, 'swarms');
    fs.mkdirSync(projectsDir, { recursive: true });
    fs.mkdirSync(swarmsDir, { recursive: true });

    writeJson(path.join(projectsDir, 'docs.json'), { projectId: 'docs', ownedPaths: ['docs/**'] });
    writeJson(path.join(projectsDir, 'core.json'), { projectId: 'core', ownedPaths: ['apps/**'] });

    writeJson(path.join(swarmsDir, 'exec.json'), {
      swarmId: 'executive-team',
      project: 'core',
      team: 'core',
      executionMode: 'structured'
    });
    writeJson(path.join(swarmsDir, 'dev.json'), {
      swarmId: 'dev-team',
      project: 'docs',
      team: 'docs',
      executionMode: 'structured',
      parentSwarm: 'executive-team'
    });

    const projects = loadProjectsFromDir(projectsDir);
    expect(() => loadSwarmsFromDir(swarmsDir, projects)).toThrow(/must share project/);
  });

  it('rejects parent cycles', () => {
    const root = makeTempDir();
    const projectsDir = path.join(root, 'projects');
    const swarmsDir = path.join(root, 'swarms');
    fs.mkdirSync(projectsDir, { recursive: true });
    fs.mkdirSync(swarmsDir, { recursive: true });

    writeJson(path.join(projectsDir, 'docs.json'), { projectId: 'docs', ownedPaths: ['docs/**'] });

    writeJson(path.join(swarmsDir, 'alpha.json'), {
      swarmId: 'alpha',
      project: 'docs',
      team: 'docs',
      executionMode: 'structured',
      parentSwarm: 'beta'
    });
    writeJson(path.join(swarmsDir, 'beta.json'), {
      swarmId: 'beta',
      project: 'docs',
      team: 'docs',
      executionMode: 'structured',
      parentSwarm: 'alpha'
    });

    const projects = loadProjectsFromDir(projectsDir);
    expect(() => loadSwarmsFromDir(swarmsDir, projects)).toThrow(/Swarm parent cycle detected/);
  });
});
