import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../../finance/determinism.ts';
import { instantiateMissionTemplate } from '../../../missions/templates/mission-template-engine.ts';
import { listMissionTemplates } from '../../../missions/templates/mission-template-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-template-determinism');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission template determinism', () => {
  it('T-MTPL-D1 identical inputs yield identical mission id', () => {
    const first = instantiateMissionTemplate('evaluate-startup-opportunity', {
      sector: 'AI agent payments',
      target_customer: 'developer platforms',
      trigger_event: 'API growth',
    });

    const second = instantiateMissionTemplate('evaluate-startup-opportunity', {
      sector: 'AI agent payments',
      target_customer: 'developer platforms',
      trigger_event: 'API growth',
    });

    expect(first.missionId).toBe(second.missionId);
    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
  });

  it('T-MTPL-D2 input parameter order does not affect mission id', () => {
    const first = instantiateMissionTemplate('evaluate-startup-opportunity', {
      sector: 'AI agent payments',
      target_customer: 'developer platforms',
      trigger_event: 'API growth',
    });

    const second = instantiateMissionTemplate('evaluate-startup-opportunity', {
      trigger_event: 'API growth',
      sector: 'AI agent payments',
      target_customer: 'developer platforms',
    });

    expect(first.missionId).toBe(second.missionId);
    expect(canonicalStringify(first.missionIdentityPayload)).toBe(canonicalStringify(second.missionIdentityPayload));
  });

  it('T-MTPL-D3 registry results are stable regardless of file insertion order', () => {
    writeJson('z-last.json', {
      templateId: 'z-last',
      missionType: 'z-last',
      displayName: 'Z Last',
      description: 'desc',
      parameters: {
        alpha: { type: 'string', required: true },
      },
      defaultObjectiveTemplate: 'Evaluate {{alpha}}',
      defaultDeliverablesTemplate: ['report'],
      allowedSourceKinds: ['market-intelligence'],
    });

    writeJson('a-first.json', {
      templateId: 'a-first',
      missionType: 'a-first',
      displayName: 'A First',
      description: 'desc',
      parameters: {
        alpha: { type: 'string', required: true },
      },
      defaultObjectiveTemplate: 'Evaluate {{alpha}}',
      defaultDeliverablesTemplate: ['report'],
      allowedSourceKinds: ['market-intelligence'],
    });

    const first = listMissionTemplates({ definitionsDir: tmpRoot }).map((entry) => entry.templateId);
    const second = listMissionTemplates({ definitionsDir: tmpRoot }).map((entry) => entry.templateId);

    expect(first).toEqual(['a-first', 'z-last']);
    expect(second).toEqual(first);
  });

  it('T-MTPL-D4 canonical output is stable across repeated instantiation calls', () => {
    const one = instantiateMissionTemplate('produce-market-memo', {
      market_topic: 'tokenized treasuries',
    });

    const two = instantiateMissionTemplate('produce-market-memo', {
      market_topic: 'tokenized treasuries',
    });

    expect(canonicalStringify(one)).toBe(canonicalStringify(two));
  });

  it('T-MTPL-D5 optional omitted fields remain deterministic', () => {
    const first = instantiateMissionTemplate('evaluate-startup-opportunity', {
      sector: 'stablecoins',
    });

    const second = instantiateMissionTemplate('evaluate-startup-opportunity', {
      sector: 'stablecoins',
    });

    expect(first.missionInstance.objective).toBe('Evaluate whether developments in stablecoins create a scalable startup opportunity.');
    expect(first.missionId).toBe(second.missionId);
  });
});
