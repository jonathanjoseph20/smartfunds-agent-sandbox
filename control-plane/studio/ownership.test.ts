import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, beforeEach } from 'vitest';

import { buildGovernanceReport, stringifyGovernanceReport } from '../governance/diagnostics';
import { loadProjectsFromDir, loadTeamsFromDir, type Project, type Team } from './registry';
import { resolveOwnership } from './ownership';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-ownership');
const projectsDir = path.join(tmpRoot, 'projects');
const teamsDir = path.join(tmpRoot, 'teams');

function resetTmpDirs(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.mkdirSync(teamsDir, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

beforeEach(() => {
  resetTmpDirs();
});

describe('ownership registry', () => {
  it('loads projects in deterministic order', () => {
    writeJson(path.join(projectsDir, 'b.json'), { projectId: 'b-project', ownedPaths: ['apps/**'] });
    writeJson(path.join(projectsDir, 'a.json'), { projectId: 'a-project', ownedPaths: ['packages/**'] });

    const projects = loadProjectsFromDir(projectsDir);
    expect(projects.map((project) => project.projectId)).toEqual(['a-project', 'b-project']);
  });

  it('rejects duplicate projectId values', () => {
    writeJson(path.join(projectsDir, 'one.json'), { projectId: 'dup', ownedPaths: ['apps/**'] });
    writeJson(path.join(projectsDir, 'two.json'), { projectId: 'dup', ownedPaths: ['packages/**'] });

    expect(() => loadProjectsFromDir(projectsDir)).toThrow(/Duplicate projectId/);
  });

  it('rejects overlapping project ownedPaths', () => {
    writeJson(path.join(projectsDir, 'one.json'), { projectId: 'one', ownedPaths: ['packages/core/**'] });
    writeJson(path.join(projectsDir, 'two.json'), { projectId: 'two', ownedPaths: ['packages/core/sub/**'] });

    expect(() => loadProjectsFromDir(projectsDir)).toThrow(/overlap detected/);
  });

  it('rejects teams referencing unknown projects', () => {
    writeJson(path.join(projectsDir, 'one.json'), { projectId: 'one', ownedPaths: ['apps/**'] });
    writeJson(path.join(teamsDir, 'team.json'), { teamId: 'team', projectId: 'unknown', ownedPaths: ['apps/**'] });

    const projects = loadProjectsFromDir(projectsDir);
    expect(() => loadTeamsFromDir(teamsDir, projects)).toThrow(/unknown projectId/);
  });

  it('rejects team ownedPaths outside project boundaries', () => {
    writeJson(path.join(projectsDir, 'one.json'), { projectId: 'one', ownedPaths: ['packages/core/**'] });
    writeJson(path.join(teamsDir, 'team.json'), { teamId: 'team', projectId: 'one', ownedPaths: ['packages/other/**'] });

    const projects = loadProjectsFromDir(projectsDir);
    expect(() => loadTeamsFromDir(teamsDir, projects)).toThrow(/outside project/);
  });

  it('rejects unknown parentTeamId references', () => {
    writeJson(path.join(projectsDir, 'one.json'), { projectId: 'one', ownedPaths: ['apps/**'] });
    writeJson(path.join(teamsDir, 'team.json'), {
      teamId: 'team',
      projectId: 'one',
      ownedPaths: ['apps/**'],
      parentTeamId: 'missing'
    });

    const projects = loadProjectsFromDir(projectsDir);
    expect(() => loadTeamsFromDir(teamsDir, projects)).toThrow(/unknown parentTeamId/);
  });
});

describe('ownership resolution', () => {
  const projects: Project[] = [
    { projectId: 'apps', ownedPaths: ['apps/**'] },
    { projectId: 'packages', ownedPaths: ['packages/**'] }
  ];

  const teams: Team[] = [
    { teamId: 'apps-team', projectId: 'apps', ownedPaths: ['apps/web/**'] },
    { teamId: 'packages-team', projectId: 'packages', ownedPaths: ['packages/core/**'] }
  ];

  it('flags ambiguous project ownership when multiple projects match', () => {
    const result = resolveOwnership({
      changedFiles: ['packages/core/index.ts'],
      projects: [
        { projectId: 'wide', ownedPaths: ['packages/**'] },
        { projectId: 'narrow', ownedPaths: ['packages/core/**'] }
      ],
      teams: []
    });

    expect(result.ownershipStatus).toBe('ambiguous_project_ownership');
  });

  it('detects multi-project changes', () => {
    const result = resolveOwnership({
      changedFiles: ['packages/core/index.ts', 'apps/web/index.ts'],
      projects,
      teams
    });

    expect(result.ownershipStatus).toBe('multi_project');
    expect(result.projectsTouched).toEqual(['apps', 'packages']);
  });

  it('detects unowned files', () => {
    const result = resolveOwnership({
      changedFiles: ['scripts/tool.ts'],
      projects: [{ projectId: 'apps', ownedPaths: ['apps/**'] }],
      teams: []
    });

    expect(result.ownershipStatus).toBe('unowned_files');
    expect(result.unownedFiles).toEqual(['scripts/tool.ts']);
  });

  it('respects allowlist paths', () => {
    const result = resolveOwnership({
      changedFiles: ['docs/readme.md', '.github/workflows/ci.yml', 'apps/web/index.ts'],
      projects: [{ projectId: 'apps', ownedPaths: ['apps/**'] }],
      teams: [{ teamId: 'apps-team', projectId: 'apps', ownedPaths: ['apps/**'] }]
    });

    expect(result.ownershipStatus).toBe('ok');
    expect(result.projectsTouched).toEqual(['apps']);
    expect(result.unownedFiles).toEqual([]);
    expect(result.teamsTouched).toEqual(['apps-team']);
  });

  it('sorts output deterministically', () => {
    const result = resolveOwnership({
      changedFiles: ['packages/zeta/index.ts', 'packages/alpha/index.ts'],
      projects: [{ projectId: 'packages', ownedPaths: ['packages/**'] }],
      teams: [
        { teamId: 'z-team', projectId: 'packages', ownedPaths: ['packages/zeta/**'] },
        { teamId: 'a-team', projectId: 'packages', ownedPaths: ['packages/alpha/**'] }
      ]
    });

    expect(result.projectsTouched).toEqual(['packages']);
    expect(result.teamsTouched).toEqual(['a-team', 'z-team']);
    expect(result.unownedFiles).toEqual([]);
  });

  it('emits stable diagnostics JSON snapshots', () => {
    const report = buildGovernanceReport({
      declaredTier: 1,
      impliedTier: 1,
      labelTier: 1,
      missingLabels: [],
      missingEvidenceFields: [],
      requiredChecks: ['lint_tier0'],
      projectsTouched: ['project'],
      teamsTouched: ['team'],
      unownedFiles: [],
      ownershipStatus: 'ok',
      nextActions: [],
      warnings: [],
      executionModesTouched: [],
      modeWarnings: [],
      unownedPaths: [],
      ambiguousPaths: []
    });

    const json = stringifyGovernanceReport(report);
    expect(json).toBe(stringifyGovernanceReport(report));
  });
});
