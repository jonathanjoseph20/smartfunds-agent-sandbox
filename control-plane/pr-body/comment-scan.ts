import type { CommentEvidenceScanResult } from './types.ts';

const TIER_LINES = new Set(['tier-0', 'tier-1', 'tier-2', 'tier-3']);

export function scanCommentsForEvidence(comments: Array<{ id: number; body: string }>): CommentEvidenceScanResult {
  const matchingIds: number[] = [];

  for (const comment of comments) {
    const lines = comment.body.replace(/\r\n?/g, '\n').split('\n');
    const hasTierLine = lines.some((line) => TIER_LINES.has(line.trim()));
    const hasEvidenceFence = lines.some((line) => line === '```evidence');

    if (hasTierLine && hasEvidenceFence) {
      matchingIds.push(comment.id);
    }
  }

  const commentIds = Array.from(new Set(matchingIds)).sort((a, b) => a - b);

  return {
    detected: commentIds.length > 0,
    count: commentIds.length,
    commentIds
  };
}
