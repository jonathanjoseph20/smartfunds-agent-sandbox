import {
  deriveMissionIdFromPayload,
  normalizeMissionIdentityPayload,
  type MissionIdentityPayload,
} from '../mission-identity.ts';
import type { MissionInstance } from '../mission-instance-types.ts';
import type {
  MissionTemplateInstantiationResult,
  NormalizedTemplateParameters,
} from './mission-template-types.ts';
import { getMissionTemplate } from './mission-template-registry.ts';
import {
  renderTemplateString,
  validateMissionTemplateParameters,
} from './mission-template-validator.ts';

function asTrimmedString(value: string | undefined): string {
  return (value ?? '').trim();
}

function toRequestedDeliverables(deliverableIds: string[]): MissionIdentityPayload['requestedDeliverables'] {
  return deliverableIds.map((deliverableId) => ({ deliverableId }));
}

function toMissionIdentityPayload(input: {
  missionType: string;
  objective: string;
  deliverableIds: string[];
  founderInstructions: string;
}): MissionIdentityPayload {
  return normalizeMissionIdentityPayload({
    missionType: input.missionType,
    objective: input.objective,
    requestedDeliverables: toRequestedDeliverables(input.deliverableIds),
    sourceReferences: [],
    linkedActionPlanIds: [],
    founderInstructions: input.founderInstructions,
    createdFrom: {
      kind: 'template',
    },
  });
}

function toMissionInstance(input: {
  missionId: string;
  missionType: string;
  displayName: string;
  objective: string;
  founderInstructions: string;
  deliverableIds: string[];
  recommendedTeams: string[];
  templateId: string;
}): MissionInstance {
  return {
    missionId: input.missionId,
    missionType: input.missionType,
    displayName: input.displayName,
    objective: input.objective,
    founderInstructions: input.founderInstructions,
    requestedDeliverables: toRequestedDeliverables(input.deliverableIds),
    sourceReferences: [],
    linkedActionPlanIds: [],
    linkedPortfolioIds: [],
    linkedMarketSynthesisIds: [],
    recommendedTeamIds: [...input.recommendedTeams],
    assignedTeamIds: [],
    approvalState: 'pending_review',
    lifecycleState: 'draft',
    readinessState: 'pending',
    completionState: 'not_started',
    blockingReasons: [],
    limitations: [],
    createdFrom: {
      kind: 'template',
      referenceId: input.templateId,
    },
    historyDigest: '',
  };
}

function buildRenderedParameters(input: {
  templateParameters: Record<string, { required: boolean }>;
  normalizedParameters: NormalizedTemplateParameters;
}): NormalizedTemplateParameters {
  const rendered: NormalizedTemplateParameters = {};

  for (const parameterName of Object.keys(input.templateParameters).sort((left, right) => left.localeCompare(right))) {
    if (Object.prototype.hasOwnProperty.call(input.normalizedParameters, parameterName)) {
      rendered[parameterName] = input.normalizedParameters[parameterName];
      continue;
    }

    if (!input.templateParameters[parameterName].required) {
      rendered[parameterName] = '';
    }
  }

  return rendered;
}

export function instantiateMissionTemplate(
  templateId: string,
  parameters: Record<string, unknown>,
  founderInstructions?: string,
  options: { definitionsDir?: string } = {},
): MissionTemplateInstantiationResult {
  const template = getMissionTemplate(templateId, { definitionsDir: options.definitionsDir });
  const normalizedParameters = validateMissionTemplateParameters(template, parameters);
  const renderedParameters = buildRenderedParameters({
    templateParameters: template.parameters,
    normalizedParameters,
  });

  const objective = renderTemplateString(template.defaultObjectiveTemplate, renderedParameters);
  const normalizedFounderInstructions = asTrimmedString(founderInstructions);

  const missionIdentityPayload = toMissionIdentityPayload({
    missionType: template.missionType,
    objective,
    deliverableIds: template.defaultDeliverablesTemplate,
    founderInstructions: normalizedFounderInstructions,
  });

  const missionId = deriveMissionIdFromPayload(missionIdentityPayload);

  const missionInstance = toMissionInstance({
    missionId,
    missionType: template.missionType,
    displayName: template.displayName,
    objective,
    founderInstructions: normalizedFounderInstructions,
    deliverableIds: template.defaultDeliverablesTemplate,
    recommendedTeams: template.recommendedTeams ?? [],
    templateId: template.templateId,
  });

  return {
    missionId,
    missionIdentityPayload,
    missionInstance,
    parameters: normalizedParameters,
  };
}
