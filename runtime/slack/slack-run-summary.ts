import type { SlackBlock, SlackMessage } from './slack-format.ts';

export type SlackRunSummaryPayload = {
  missionId?: string | null;
  missionName?: string | null;
  status?: 'completed' | 'failed' | string | null;
  resultCounts?: Record<string, unknown> | null;
  artifacts?: unknown[] | null;
  failureCode?: string | null;
  failureMessage?: string | null;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
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

function formatMetricKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function extractMetrics(resultCounts: Record<string, unknown> | null | undefined): string[] {
  if (!resultCounts) {
    return [];
  }
  return Object.entries(resultCounts)
    .filter(([, value]) => typeof value === 'number')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${formatMetricKey(key)}: ${String(value)}`);
}

function extractArtifacts(value: unknown[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const artifacts = value
    .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry as string);

  return Array.from(new Set(artifacts)).sort((left, right) => left.localeCompare(right));
}

function sanitizeFailureMessage(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const firstLine = value.split('\n')[0]?.trim() ?? '';
  if (!firstLine) {
    return null;
  }
  return firstLine;
}

export function formatSlackRunSummary(payload: SlackRunSummaryPayload): SlackMessage {
  const mission = asNonEmptyString(payload.missionName) ?? asNonEmptyString(payload.missionId) ?? 'unknown-mission';
  const status = asNonEmptyString(payload.status) ?? 'completed';
  const metrics = extractMetrics(payload.resultCounts);
  const artifacts = extractArtifacts(payload.artifacts);
  const failureCode = asNonEmptyString(payload.failureCode);
  const failureMessage = sanitizeFailureMessage(asNonEmptyString(payload.failureMessage));
  const failed = status === 'failed';

  const lines: string[] = [
    `Mission: ${mission}`,
    `Status: ${status}`
  ];

  if (metrics.length > 0) {
    lines.push('', ...metrics);
  }

  if (artifacts.length > 0) {
    lines.push('', 'Artifacts generated:', ...artifacts.map((artifact) => `- ${artifact}`));
  }

  if (failed) {
    lines.push('');
    lines.push(`Failure Code: ${failureCode ?? 'MISSION_FAILED'}`);
    if (failureMessage) {
      lines.push(`Failure: ${failureMessage}`);
    }
  }

  return {
    text: `${failed ? 'Mission failed' : 'Mission completed'}: ${mission}`,
    blocks: [
      section(`*${failed ? 'Mission failed' : 'Mission completed'}*`),
      section(lines.join('\n'))
    ]
  };
}
