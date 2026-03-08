import type { SlackBlock, SlackMessage } from './slack-format.ts';

export type SlackProgressEventType =
  | 'mission_started'
  | 'step_started'
  | 'step_completed'
  | 'mission_completed'
  | 'mission_failed';

export type SlackProgressPayload = {
  missionId?: string | null;
  missionName?: string | null;
  stepName?: string | null;
  stepIndex?: number | null;
  totalSteps?: number | null;
  status?: string | null;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function section(text: string): SlackBlock {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text
    }
  };
}

function resolveMissionName(payload: SlackProgressPayload): string {
  return asNonEmptyString(payload.missionName) ?? asNonEmptyString(payload.missionId) ?? 'unknown-mission';
}

export function formatSlackProgress(event: SlackProgressEventType, payload: SlackProgressPayload): SlackMessage {
  const mission = resolveMissionName(payload);
  const stepName = asNonEmptyString(payload.stepName);
  const stepIndex = asCount(payload.stepIndex);
  const totalSteps = asCount(payload.totalSteps);
  const status = asNonEmptyString(payload.status);

  const stepLine = stepIndex && totalSteps
    ? `Step ${stepIndex}/${totalSteps}${stepName ? ` ${stepName}` : ''}`
    : stepName
      ? `Step ${stepName}`
      : null;

  const lines = [`Mission: ${mission}`];
  if (stepLine) {
    lines.push(stepLine);
  }
  if (status) {
    lines.push(`Status: ${status}`);
  }

  const titleByEvent: Record<SlackProgressEventType, string> = {
    mission_started: 'Mission started',
    step_started: 'Step started',
    step_completed: 'Step completed',
    mission_completed: 'Mission completed',
    mission_failed: 'Mission failed'
  };

  return {
    text: `${titleByEvent[event]}: ${mission}`,
    blocks: [
      section(`*${titleByEvent[event]}*`),
      section(lines.join('\n'))
    ]
  };
}
