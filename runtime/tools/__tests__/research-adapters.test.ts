import { describe, expect, it } from 'vitest';

import { browserFetch } from '../adapters/browser-fetch.ts';
import { commodityData } from '../adapters/commodity-data.ts';
import { companyExtract } from '../adapters/company-extract.ts';
import { contactExtract } from '../adapters/contact-extract.ts';
import { domainClassify } from '../adapters/domain-classify.ts';
import { emailExtract } from '../adapters/email-extract.ts';
import { listRank } from '../adapters/list-rank.ts';
import { pdfExtract } from '../adapters/pdf-extract.ts';
import { tableExtract } from '../adapters/table-extract.ts';
import { dedupeUrls, normalizeUrl } from '../adapters/url-normalize.ts';

describe('runtime research adapters', () => {
  it('T-R1 normalizes urls and dedupes deterministically', () => {
    expect(normalizeUrl('HTTPS://Example.com/a/?utm_source=x&b=2#frag')).toBe('https://example.com/a?b=2');
    expect(dedupeUrls([
      'https://example.com/a?utm_campaign=x',
      'https://example.com/a',
      'https://z.com/'
    ])).toEqual([
      'https://example.com/a',
      'https://z.com/'
    ]);
  });

  it('T-R2 classifies domain using deterministic heuristics', () => {
    expect(domainClassify({ url: 'https://www.sec.gov/files/x' })).toEqual({
      domain: 'www.sec.gov',
      domainType: 'government'
    });

    expect(domainClassify({ url: 'https://blog.example.com/post' }).domainType).toBe('blog');
  });

  it('T-R3 extracts emails from html deterministically', () => {
    const result = emailExtract({
      html: '<a href="mailto:ALICE@EXAMPLE.ORG">A</a> Contact bob@example.org and alice@example.org'
    });

    expect(result).toEqual({
      emails: ['alice@example.org', 'bob@example.org']
    });
  });

  it('T-R4 extracts html tables with stable columns/rows', () => {
    const html = '<table><tr><th>Company Name</th><th>Mineral</th></tr><tr><td>Alpha Mining</td><td>Lithium</td></tr></table>';
    const result = tableExtract({ html });

    expect(result).toEqual({
      tables: [{
        tableName: 'table_1',
        columns: ['company_name', 'mineral'],
        rows: [{ company_name: 'Alpha Mining', mineral: 'Lithium' }]
      }]
    });
  });

  it('T-R5 extracts company entities with extractor + heuristic merge', async () => {
    const result = await companyExtract({
      url: 'https://alpha.example.com',
      html: '<html><head><title>Alpha Mining</title></head></html>',
      text: 'Alpha Mining explores lithium in Nevada',
      extractor: {
        async extract() {
          return [{
            organization: 'Alpha Mining',
            industry: 'Mining',
            minerals: ['lithium', 'nickel'],
            location: 'Nevada',
            project_stage: 'exploration',
            website: 'https://alpha.example.com',
            description: 'Developer'
          }];
        }
      }
    });

    expect(result.companies[0]).toEqual({
      organization: 'Alpha Mining',
      industry: 'Mining',
      minerals: ['lithium', 'nickel'],
      location: 'Nevada',
      project_stage: 'exploration',
      website: 'https://alpha.example.com/',
      description: 'Developer',
      source: 'https://alpha.example.com/'
    });
  });

  it('T-R6 extracts contacts deterministically and dedupes by email', async () => {
    const result = await contactExtract({
      organization: 'Alpha Mining',
      url: 'https://alpha.example.com/team',
      html: 'Contact: <a href="mailto:ceo@alpha.example">ceo@alpha.example</a> and <a href="mailto:ceo@alpha.example">ceo@alpha.example</a> linkedin https://www.linkedin.com/in/alice-ceo/',
      extractor: {
        async extract() {
          return [{
            name: 'Alice CEO',
            role: 'CEO',
            email: 'ceo@alpha.example',
            linkedin: 'https://www.linkedin.com/in/alice-ceo/',
            organization: 'Alpha Mining'
          }];
        }
      }
    });

    expect(result.contacts).toEqual([{ 
      name: 'Alice CEO',
      role: 'CEO',
      email: 'ceo@alpha.example',
      linkedin: 'https://www.linkedin.com/in/alice-ceo',
      organization: 'Alpha Mining',
      source: 'https://alpha.example.com/team'
    }]);
  });

  it('T-R7 normalizes commodity rows with deterministic collateral score', () => {
    const result = commodityData({
      rows: [{
        commodity: 'Copper',
        price: '$101.5',
        daily_volume: '200',
        market_liquidity: '80',
        volatility: '10',
        exchange: 'CME',
        source: 'https://example.com/copper'
      }]
    });

    expect(result.rows[0]).toEqual({
      commodity: 'Copper',
      price: 101.5,
      daily_volume: 200,
      market_liquidity: 80,
      volatility: 10,
      exchange: 'CME',
      source: 'https://example.com/copper',
      collateral_score: 98
    });
  });

  it('T-R8 ranks sources deterministically with tie-breakers', () => {
    const result = listRank({
      entities: [
        { source: 'B Source', category: 'news', credibility: 70, coverage: 80, domain_type: 'news' },
        { source: 'A Source', category: 'news', credibility: 70, coverage: 80, domain_type: 'news' }
      ]
    });

    expect(result.ranked.map((entry) => entry.source)).toEqual(['A Source', 'B Source']);
    expect(result.ranked[0].identity).toHaveLength(64);
  });

  it('T-R9 browser fetch uses renderer abstraction and normalizes output', async () => {
    const result = await browserFetch({
      url: 'https://example.com',
      renderer: {
        async fetch() {
          return {
            finalUrl: 'https://example.com/final',
            status: 200,
            html: '<html>\r\n<body>ok</body></html>',
            title: ' Example ',
            description: ' Desc '
          };
        }
      }
    });

    expect(result).toEqual({
      finalUrl: 'https://example.com/final',
      status: 200,
      html: '<html>\n<body>ok</body></html>',
      metadata: {
        title: 'Example',
        description: 'Desc'
      }
    });
  });

  it('T-R10 pdf extract uses parser abstraction and stable shape', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const result = await pdfExtract({
      pdfContent: bytes,
      pdfParser: {
        async parse() {
          return {
            title: ' Demo PDF ',
            pages: 3,
            text: 'Line 1\n\nLine 2'
          };
        }
      }
    });

    expect(result).toEqual({
      title: 'Demo PDF',
      pages: 3,
      text: 'Line 1\nLine 2'
    });
  });
});
