import { extractDomain } from './url-normalize.ts';

export type DomainType = 'news' | 'company' | 'exchange' | 'research' | 'government' | 'blog' | 'unknown';

function classifyByDomain(domain: string): DomainType {
  if (domain.endsWith('.gov') || domain.endsWith('.gov.uk')) {
    return 'government';
  }

  if (domain.includes('sec.gov') || domain.includes('nasa.gov')) {
    return 'government';
  }

  if (domain.includes('bloomberg') || domain.includes('reuters') || domain.includes('wsj') || domain.includes('ft.com') || domain.includes('nytimes')) {
    return 'news';
  }

  if (domain.includes('arxiv.org') || domain.includes('ssrn.com') || domain.includes('researchgate') || domain.includes('springer') || domain.includes('nature.com')) {
    return 'research';
  }

  if (domain.includes('substack') || domain.includes('medium.com') || domain.includes('blog.')) {
    return 'blog';
  }

  if (domain.includes('coinbase') || domain.includes('kraken') || domain.includes('binance') || domain.includes('cmegroup') || domain.includes('nyse') || domain.includes('nasdaq')) {
    return 'exchange';
  }

  if (domain.length > 0) {
    return 'company';
  }

  return 'unknown';
}

function classifyByMetadata(input: {
  title?: string;
  content?: string;
  current: DomainType;
}): DomainType {
  const text = `${input.title ?? ''} ${input.content ?? ''}`.toLowerCase();
  if (input.current === 'unknown' && text.length === 0) {
    return 'unknown';
  }

  if (text.includes('press release') || text.includes('breaking news')) {
    return 'news';
  }

  if (text.includes('whitepaper') || text.includes('research report') || text.includes('methodology')) {
    return 'research';
  }

  if (text.includes('exchange') || text.includes('order book')) {
    return 'exchange';
  }

  if (text.includes('blog')) {
    return 'blog';
  }

  return input.current;
}

export function domainClassify(input: {
  url: string;
  title?: string;
  content?: string;
}): { domain: string; domainType: DomainType } {
  const domain = extractDomain(input.url);
  const primary = classifyByDomain(domain);
  const domainType = classifyByMetadata({
    title: input.title,
    content: input.content,
    current: primary
  });

  return { domain, domainType };
}
