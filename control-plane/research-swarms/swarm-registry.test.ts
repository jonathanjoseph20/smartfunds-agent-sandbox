import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSwarmRegistry, loadSwarmDefinitions } from './swarm-registry.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-swarm-definitions');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('swarm registry', () => {
  it('T-SW-R1 loads valid definitions in deterministic order', () => {
    writeJson('zeta.json', {
      swarmId: 'zeta',
      displayName: 'Zeta Swarm',
      teamId: 'defi-risk-team',
      investigationTemplates: ['protocol-risk-investigation', 'protocol-risk-investigation'],
      completionRules: {
        requireAllInvestigationsComplete: true,
        requireResolvedConflicts: true
      }
    });
    writeJson('alpha.json', {
      swarmId: 'alpha',
      displayName: 'Alpha Swarm',
      teamId: 'defi-risk-team',
      investigationTemplates: ['governance-proposal-investigation'],
      completionRules: {
        requireAllInvestigationsComplete: false,
        requireResolvedConflicts: true
      }
    });

    const loaded = loadSwarmDefinitions({ definitionsDir: tmpRoot });
    expect(loaded.map((entry) => entry.swarmId)).toEqual(['alpha', 'zeta']);
    expect(loaded[1]?.investigationTemplates).toEqual(['protocol-risk-investigation']);
  });

  it('T-SW-R2 rejects invalid schema', () => {
    writeJson('invalid.json', {
      swarmId: 'bad',
      displayName: 'Bad',
      teamId: 'defi-risk-team',
      investigationTemplates: ['protocol-risk-investigation'],
      completionRules: {
        requireResolvedConflicts: true
      }
    });

    expect(() => loadSwarmDefinitions({ definitionsDir: tmpRoot })).toThrow(/requireAllInvestigationsComplete must be a boolean/);
  });

  it('T-SW-R3 rejects duplicate swarm ids', () => {
    writeJson('a.json', {
      swarmId: 'dup',
      displayName: 'A',
      teamId: 'defi-risk-team',
      investigationTemplates: ['protocol-risk-investigation'],
      completionRules: {
        requireAllInvestigationsComplete: true,
        requireResolvedConflicts: true
      }
    });
    writeJson('b.json', {
      swarmId: 'dup',
      displayName: 'B',
      teamId: 'defi-risk-team',
      investigationTemplates: ['governance-proposal-investigation'],
      completionRules: {
        requireAllInvestigationsComplete: true,
        requireResolvedConflicts: true
      }
    });

    expect(() => createSwarmRegistry({ definitionsDir: tmpRoot })).toThrow(/Duplicate swarmId detected/);
  });
});
