const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function extractMailtoEmails(html: string): string[] {
  const matched = [...html.matchAll(/mailto:([^"'?#\s>]+)/gi)];
  return matched
    .map((entry) => entry[1].trim().toLowerCase())
    .filter((value) => value.length > 0);
}

function extractPatternEmails(html: string): string[] {
  const matched = html.match(EMAIL_PATTERN) ?? [];
  return matched
    .map((entry) => entry.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

function isLikelyValid(email: string): boolean {
  if (!email.includes('@')) {
    return false;
  }

  if (email.includes('example.com') || email.includes('email.com')) {
    return false;
  }

  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return false;
  }

  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

export function emailExtract(input: { html: string }): { emails: string[] } {
  const candidates = [
    ...extractMailtoEmails(input.html),
    ...extractPatternEmails(input.html)
  ];

  const deduped = [...new Set(candidates.filter(isLikelyValid))]
    .sort((left, right) => left.localeCompare(right));

  return { emails: deduped };
}
