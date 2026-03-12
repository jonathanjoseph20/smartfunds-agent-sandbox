import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTeamMaterializer } from '../../teams/team-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-team-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('team materializer', () => {
  it('T-TM1 projection-driven output and deterministic repeat', () => {
    const materializer = createTeamMaterializer({ artifactsRoot: path.join(tmpRoot, 'artifacts', 'teams') });

    const first = materializer.materializeOne('venture-opportunity-team');
    const firstSnapshot = {
      status: fs.readFileSync(first.statusPath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.markdownPath, 'utf8'),
      history: fs.readFileSync(first.historyPath, 'utf8'),
    };

    const second = materializer.materializeOne('venture-opportunity-team');
    const secondSnapshot = {
      status: fs.readFileSync(second.statusPath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.markdownPath, 'utf8'),
      history: fs.readFileSync(second.historyPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
    expect(firstSnapshot.markdown).toContain('# Team Registry Report');
  });

  it('T-TM2 artifacts do not mutate source definitions', () => {
    const definitionPath = path.join('control-plane', 'teams', 'definitions', 'venture-opportunity-team.json');
    const before = fs.readFileSync(definitionPath, 'utf8');

    const materializer = createTeamMaterializer({ artifactsRoot: path.join(tmpRoot, 'artifacts', 'teams') });
    materializer.materializeOne('venture-opportunity-team');

    const after = fs.readFileSync(definitionPath, 'utf8');
    expect(after).toBe(before);
  });
});
