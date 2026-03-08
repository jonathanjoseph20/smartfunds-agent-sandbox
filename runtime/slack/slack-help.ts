import type { SlackBlock, SlackMessage } from './slack-format.ts';

const HELP_LINES = [
  'Available commands:',
  '',
  '/mission run <mission>',
  '/mission status <id>',
  '/mission list',
  '/mission logs <id>',
  '/artifact <missionId>',
  '/mission help'
] as const;

function section(text: string): SlackBlock {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text
    }
  };
}

export function formatSlackHelpMessage(): SlackMessage {
  const text = HELP_LINES.join('\n');
  return {
    text: 'Mission command help',
    blocks: [
      section('*Mission Control Help*'),
      section(text)
    ]
  };
}

export function slackHelpUsageText(): string {
  return HELP_LINES.join('\n');
}
