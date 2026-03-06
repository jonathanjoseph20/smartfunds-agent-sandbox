import { describe, expect, it } from 'vitest';

import { validateAgentProfileDefinition } from './agent-profile-validator.ts';

function validProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agentId: 'lead-thesis-architect',
    displayName: 'Lead Thesis Architect',
    role: 'research-lead',
    projectId: 'smartfunds-core',
    adapterType: 'llm',
    personalityProfile: {
      tone: 'measured and intellectually confident',
      reasoningStyle: 'top-down synthesis first, then evidence validation',
      temperament: 'calm, strategic, selective',
      collaborationStyle: 'delegates detail work',
      communicationStyle: 'structured, concise'
    },
    skillsProfile: {
      coreSkills: ['market synthesis', 'thesis construction'],
      secondarySkills: ['executive summarization'],
      domains: ['RWA', 'tokenization']
    },
    backgroundProfile: {
      professionalArchetype: 'buy-side strategist',
      domainBackground: ['private markets', 'crypto market structure'],
      perspectiveBiases: ['prefers asymmetric opportunities']
    },
    outputProfile: {
      preferredFormat: 'structured memo',
      verbosity: 'medium',
      citationStyle: 'internal evidence references',
      decisionStyle: 'rank and justify'
    },
    constraintsProfile: {
      mustDo: ['state assumptions clearly'],
      mustNotDo: ['overstate market size']
    },
    toolProfile: {
      allowedAdapters: ['llm', 'repo'],
      preferredTools: ['llm'],
      forbiddenTools: ['shell']
    },
    ...overrides
  };
}

describe('agent-profile-validator', () => {
  it('T-A1 validates a complete profile', () => {
    const profile = validateAgentProfileDefinition(validProfile());

    expect(profile.agentId).toBe('lead-thesis-architect');
    expect(profile.toolProfile.allowedAdapters).toEqual(['llm', 'repo']);
  });

  it('T-A2 rejects missing required sections', () => {
    const payload = validProfile();
    delete payload.personalityProfile;

    expect(() => validateAgentProfileDefinition(payload)).toThrow(/missing required section: personalityProfile/);
  });

  it('T-A3 rejects invalid adapterType', () => {
    expect(() => validateAgentProfileDefinition(validProfile({ adapterType: 'web' }))).toThrow(/adapterType must be one of/);
  });

  it('T-A4 rejects invalid toolProfile rules', () => {
    expect(() => validateAgentProfileDefinition(validProfile({
      toolProfile: {
        allowedAdapters: ['llm'],
        preferredTools: ['shell'],
        forbiddenTools: []
      }
    }))).toThrow(/preferredTools must be a subset of allowedAdapters/);
  });
});
