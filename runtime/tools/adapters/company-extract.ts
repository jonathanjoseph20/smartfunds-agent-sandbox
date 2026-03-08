import { extractDomain, normalizeUrl } from './url-normalize.ts';

export interface CompanyEntity {
  organization: string;
  industry: string;
  minerals: string[];
  location: string;
  project_stage: string;
  website: string;
  description: string;
  source?: string;
}

export interface CompanyExtractor {
  extract(input: { html?: string; text?: string; url?: string }): Promise<CompanyEntity[] | CompanyEntity>;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeMinerals(input: unknown): string[] {
  if (Array.isArray(input)) {
    return [...new Set(input
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => normalizeWhitespace(entry.toLowerCase()))
      .filter((entry) => entry.length > 0))]
      .sort((left, right) => left.localeCompare(right));
  }

  if (typeof input === 'string') {
    return normalizeMinerals(input.split(',').map((entry) => entry.trim()));
  }

  return [];
}

function normalizeCompanyEntity(input: Partial<CompanyEntity>, fallbackUrl?: string): CompanyEntity {
  const website = normalizeUrl(input.website ?? fallbackUrl ?? '');
  return {
    organization: normalizeWhitespace(input.organization ?? ''),
    industry: normalizeWhitespace(input.industry ?? ''),
    minerals: normalizeMinerals(input.minerals),
    location: normalizeWhitespace(input.location ?? ''),
    project_stage: normalizeWhitespace(input.project_stage ?? ''),
    website,
    description: normalizeWhitespace(input.description ?? ''),
    ...(fallbackUrl ? { source: normalizeUrl(fallbackUrl) } : {})
  };
}

function heuristicCompany(input: { html?: string; text?: string; url?: string }): CompanyEntity[] {
  const html = input.html ?? '';
  const text = input.text ?? '';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const org = normalizeWhitespace((h1Match?.[1] ?? titleMatch?.[1] ?? '').replace(/<[^>]+>/g, ''));
  const description = normalizeWhitespace(text.split('\n').slice(0, 2).join(' '));

  if (org.length === 0 && description.length === 0) {
    return [];
  }

  return [normalizeCompanyEntity({
    organization: org,
    industry: text.toLowerCase().includes('mining') ? 'mining' : '',
    minerals: text.match(/\b(lithium|nickel|copper|gold|silver|uranium)\b/gi) ?? [],
    location: '',
    project_stage: '',
    website: input.url ?? '',
    description
  }, input.url)];
}

function dedupeCompanies(entities: CompanyEntity[]): CompanyEntity[] {
  const map = new Map<string, CompanyEntity>();

  for (const entity of entities) {
    const key = `${entity.organization.toLowerCase()}|${extractDomain(entity.website)}`;
    const previous = map.get(key);
    if (!previous) {
      map.set(key, entity);
      continue;
    }

    map.set(key, {
      ...previous,
      industry: previous.industry.length > 0 ? previous.industry : entity.industry,
      minerals: [...new Set([...previous.minerals, ...entity.minerals])].sort((left, right) => left.localeCompare(right)),
      location: previous.location.length > 0 ? previous.location : entity.location,
      project_stage: previous.project_stage.length > 0 ? previous.project_stage : entity.project_stage,
      description: previous.description.length > 0 ? previous.description : entity.description,
      website: previous.website.length > 0 ? previous.website : entity.website,
      source: previous.source ?? entity.source
    });
  }

  return [...map.values()].sort((left, right) => {
    const orgCompare = left.organization.localeCompare(right.organization);
    if (orgCompare !== 0) {
      return orgCompare;
    }
    return left.website.localeCompare(right.website);
  });
}

export async function companyExtract(input: {
  html?: string;
  text?: string;
  url?: string;
  extractor?: CompanyExtractor;
}): Promise<{ companies: CompanyEntity[] }> {
  const fromModel = input.extractor
    ? await input.extractor.extract({ html: input.html, text: input.text, url: input.url })
    : [];

  const modeled = (Array.isArray(fromModel) ? fromModel : [fromModel])
    .map((entry) => normalizeCompanyEntity(entry, input.url))
    .filter((entry) => entry.organization.length > 0 || entry.website.length > 0);

  const heuristics = heuristicCompany(input);
  return {
    companies: dedupeCompanies([...modeled, ...heuristics])
  };
}
