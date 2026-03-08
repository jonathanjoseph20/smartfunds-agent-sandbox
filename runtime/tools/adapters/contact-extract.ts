import { emailExtract } from './email-extract.ts';

export interface ContactEntity {
  name: string;
  role: string;
  email: string;
  linkedin: string;
  organization: string;
  source?: string;
}

export interface ContactExtractor {
  extract(input: { html?: string; text?: string; url?: string }): Promise<ContactEntity[] | ContactEntity>;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeLinkedIn(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  const matched = trimmed.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/i);
  if (!matched) {
    return '';
  }

  return matched[0]
    .replace(/\/+$/g, '')
    .toLowerCase();
}

function normalizeContact(input: Partial<ContactEntity>, fallbackOrg: string, source?: string): ContactEntity {
  return {
    name: normalizeWhitespace(input.name ?? ''),
    role: normalizeWhitespace(input.role ?? ''),
    email: normalizeWhitespace((input.email ?? '').toLowerCase()),
    linkedin: normalizeLinkedIn(input.linkedin ?? ''),
    organization: normalizeWhitespace(input.organization ?? fallbackOrg),
    ...(source ? { source } : {})
  };
}

function heuristicContacts(input: { html?: string; text?: string; url?: string; organization?: string }): ContactEntity[] {
  const html = input.html ?? '';
  const text = input.text ?? '';
  const emails = emailExtract({ html }).emails;
  const linkedins = [...html.matchAll(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/gi)]
    .map((entry) => normalizeLinkedIn(entry[0] ?? ''))
    .filter((entry) => entry.length > 0)
    .sort((left, right) => left.localeCompare(right));

  return emails.map((email, index) => normalizeContact({
    name: '',
    role: text.toLowerCase().includes('ceo') ? 'CEO' : '',
    email,
    linkedin: linkedins[index] ?? '',
    organization: input.organization ?? ''
  }, input.organization ?? '', input.url));
}

function dedupeContacts(contacts: ContactEntity[]): ContactEntity[] {
  const deduped = new Map<string, ContactEntity>();

  for (const contact of contacts) {
    const key = contact.email.length > 0
      ? `email:${contact.email}`
      : `name:${contact.name.toLowerCase()}|org:${contact.organization.toLowerCase()}`;
    const previous = deduped.get(key);
    if (!previous) {
      deduped.set(key, contact);
      continue;
    }

    deduped.set(key, {
      ...previous,
      name: previous.name.length > 0 ? previous.name : contact.name,
      role: previous.role.length > 0 ? previous.role : contact.role,
      linkedin: previous.linkedin.length > 0 ? previous.linkedin : contact.linkedin,
      organization: previous.organization.length > 0 ? previous.organization : contact.organization,
      source: previous.source ?? contact.source
    });
  }

  return [...deduped.values()].sort((left, right) => {
    const emailCompare = left.email.localeCompare(right.email);
    if (emailCompare !== 0) {
      return emailCompare;
    }
    return left.name.localeCompare(right.name);
  });
}

export async function contactExtract(input: {
  html?: string;
  text?: string;
  url?: string;
  organization?: string;
  extractor?: ContactExtractor;
}): Promise<{ contacts: ContactEntity[] }> {
  const extracted = input.extractor
    ? await input.extractor.extract({ html: input.html, text: input.text, url: input.url })
    : [];

  const modeled = (Array.isArray(extracted) ? extracted : [extracted])
    .map((entry) => normalizeContact(entry, input.organization ?? '', input.url))
    .filter((entry) => entry.email.length > 0 || entry.name.length > 0);

  const heuristics = heuristicContacts(input);
  return {
    contacts: dedupeContacts([...modeled, ...heuristics])
  };
}
