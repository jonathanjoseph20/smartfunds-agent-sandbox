import { describe, expect, it } from 'vitest';

import {
  validateMissionTemplateDefinition,
  validateMissionTemplateParameters,
} from '../../../missions/templates/mission-template-validator.ts';

function validDefinition(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    templateId: 'evaluate-startup-opportunity',
    missionType: 'evaluate-startup-opportunity',
    displayName: 'Evaluate Startup Opportunity',
    description: 'Evaluate a startup opportunity.',
    parameters: {
      alpha: {
        type: 'string',
        required: true,
      },
      beta: {
        type: 'number',
        required: false,
      },
      gamma: {
        type: 'boolean',
        required: false,
      },
    },
    defaultObjectiveTemplate: 'Evaluate {{alpha}}',
    defaultDeliverablesTemplate: ['memo'],
    allowedSourceKinds: ['market-intelligence'],
    ...overrides,
  };
}

describe('mission template validation', () => {
  it('T-MTPL-V1 accepts a valid template definition', () => {
    const validated = validateMissionTemplateDefinition(validDefinition());

    expect(validated.templateId).toBe('evaluate-startup-opportunity');
    expect(Object.keys(validated.parameters)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('T-MTPL-V2 rejects invalid parameter type', () => {
    expect(() => validateMissionTemplateDefinition(validDefinition({
      parameters: {
        alpha: {
          type: 'date',
          required: true,
        },
      },
    }))).toThrow(/parameters.alpha.type/);
  });

  it('T-MTPL-V3 rejects missing required definition field', () => {
    expect(() => validateMissionTemplateDefinition(validDefinition({ displayName: '' }))).toThrow(/displayName/);
  });

  it('T-MTPL-V4 rejects unknown token references in objective template', () => {
    expect(() => validateMissionTemplateDefinition(validDefinition({
      defaultObjectiveTemplate: 'Evaluate {{unknown_token}}',
    }))).toThrow(/references unknown parameter: unknown_token/);
  });

  it('T-MTPL-V5 rejects unknown instantiation parameter', () => {
    const template = validateMissionTemplateDefinition(validDefinition());

    expect(() => validateMissionTemplateParameters(template, {
      alpha: 'a',
      unknown: 'b',
    })).toThrow('Unknown template parameter: unknown');
  });

  it('T-MTPL-V6 rejects missing required instantiation parameter', () => {
    const template = validateMissionTemplateDefinition(validDefinition());

    expect(() => validateMissionTemplateParameters(template, {})).toThrow('Missing required template parameter: alpha');
  });

  it('T-MTPL-V7 rejects wrong instantiation parameter type without coercion', () => {
    const template = validateMissionTemplateDefinition(validDefinition());

    expect(() => validateMissionTemplateParameters(template, {
      alpha: 'ok',
      beta: '123',
    })).toThrow('Invalid template parameter type for beta: expected number');
  });

  it('T-MTPL-V8 normalizes parameter ordering deterministically', () => {
    const template = validateMissionTemplateDefinition(validDefinition());

    const normalized = validateMissionTemplateParameters(template, {
      gamma: true,
      alpha: 'sector',
      beta: 2,
    });

    expect(Object.keys(normalized)).toEqual(['alpha', 'beta', 'gamma']);
  });
});
