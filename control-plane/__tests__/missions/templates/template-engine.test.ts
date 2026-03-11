import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import * as missionIdentity from '../../../missions/mission-identity.ts';
import { instantiateMissionTemplate } from '../../../missions/templates/mission-template-engine.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-template-engine');

function writeTemplate(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission template engine', () => {
  it('T-MTPL-E1 performs exact substitution for required string parameter', () => {
    writeTemplate('string-template.json', {
      templateId: 'string-template',
      missionType: 'string-template',
      displayName: 'String Template',
      description: 'desc',
      parameters: {
        topic: {
          type: 'string',
          required: true,
        },
      },
      defaultObjectiveTemplate: 'Analyze {{topic}}',
      defaultDeliverablesTemplate: ['report'],
      allowedSourceKinds: ['market-intelligence'],
    });

    const result = instantiateMissionTemplate('string-template', { topic: 'stablecoins' }, undefined, {
      definitionsDir: tmpRoot,
    });

    expect(result.missionInstance.objective).toBe('Analyze stablecoins');
  });

  it('T-MTPL-E2 missing optional parameter substitutes to empty string', () => {
    writeTemplate('optional-template.json', {
      templateId: 'optional-template',
      missionType: 'optional-template',
      displayName: 'Optional Template',
      description: 'desc',
      parameters: {
        sector: { type: 'string', required: true },
        target: { type: 'string', required: false },
      },
      defaultObjectiveTemplate: 'Analyze {{sector}} for {{target}}',
      defaultDeliverablesTemplate: ['report'],
      allowedSourceKinds: ['market-intelligence'],
    });

    const result = instantiateMissionTemplate('optional-template', { sector: 'payments' }, undefined, {
      definitionsDir: tmpRoot,
    });

    expect(result.missionInstance.objective).toBe('Analyze payments for ');
  });

  it('T-MTPL-E3 supports number and boolean substitution', () => {
    writeTemplate('typed-template.json', {
      templateId: 'typed-template',
      missionType: 'typed-template',
      displayName: 'Typed Template',
      description: 'desc',
      parameters: {
        confidence: { type: 'number', required: true },
        include_risks: { type: 'boolean', required: true },
      },
      defaultObjectiveTemplate: 'Confidence {{confidence}} include_risks {{include_risks}}',
      defaultDeliverablesTemplate: ['report'],
      allowedSourceKinds: ['market-intelligence'],
    });

    const result = instantiateMissionTemplate('typed-template', {
      confidence: 0.7,
      include_risks: true,
    }, undefined, {
      definitionsDir: tmpRoot,
    });

    expect(result.missionInstance.objective).toBe('Confidence 0.7 include_risks true');
  });

  it('T-MTPL-E4 copies deliverables and founder instructions deterministically', () => {
    writeTemplate('deliverables-template.json', {
      templateId: 'deliverables-template',
      missionType: 'deliverables-template',
      displayName: 'Deliverables Template',
      description: 'desc',
      parameters: {
        topic: { type: 'string', required: true },
      },
      defaultObjectiveTemplate: 'Topic {{topic}}',
      defaultDeliverablesTemplate: ['one', 'two'],
      allowedSourceKinds: ['market-intelligence'],
      recommendedTeams: ['team-a'],
    });

    const result = instantiateMissionTemplate('deliverables-template', { topic: 'alpha' }, '  keep concise  ', {
      definitionsDir: tmpRoot,
    });

    expect(result.missionInstance.founderInstructions).toBe('keep concise');
    expect(result.missionInstance.requestedDeliverables).toEqual([
      { deliverableId: 'one' },
      { deliverableId: 'two' },
    ]);
    expect(result.missionInstance.recommendedTeamIds).toEqual(['team-a']);
  });

  it('T-MTPL-E5 populates createdFrom provenance with existing mission semantics', () => {
    writeTemplate('created-from-template.json', {
      templateId: 'created-from-template',
      missionType: 'created-from-template',
      displayName: 'Created From Template',
      description: 'desc',
      parameters: {
        topic: { type: 'string', required: true },
      },
      defaultObjectiveTemplate: 'Topic {{topic}}',
      defaultDeliverablesTemplate: ['report'],
      allowedSourceKinds: ['market-intelligence'],
    });

    const result = instantiateMissionTemplate('created-from-template', { topic: 'x' }, undefined, {
      definitionsDir: tmpRoot,
    });

    expect(result.missionInstance.createdFrom).toEqual({
      kind: 'template',
      referenceId: 'created-from-template',
    });
  });

  it('T-MTPL-E6 reuses existing mission identity generation path', () => {
    writeTemplate('identity-template.json', {
      templateId: 'identity-template',
      missionType: 'identity-template',
      displayName: 'Identity Template',
      description: 'desc',
      parameters: {
        topic: { type: 'string', required: true },
      },
      defaultObjectiveTemplate: 'Topic {{topic}}',
      defaultDeliverablesTemplate: ['report'],
      allowedSourceKinds: ['market-intelligence'],
    });

    const deriveSpy = vi.spyOn(missionIdentity, 'deriveMissionIdFromPayload');
    const result = instantiateMissionTemplate('identity-template', { topic: 'x' }, undefined, {
      definitionsDir: tmpRoot,
    });

    expect(deriveSpy).toHaveBeenCalledTimes(1);
    expect(result.missionInstance.missionId).toBe(result.missionId);
    expect(result.missionInstance.missionType).toBe('identity-template');
    expect(result.missionIdentityPayload.createdFrom.kind).toBe('template');

    deriveSpy.mockRestore();
  });
});
