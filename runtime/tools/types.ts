export interface ToolRequest {
  toolId: string;
  action: string;
  input: Record<string, unknown>;
}

export interface ToolResponse {
  toolId: string;
  action: string;
  ok: boolean;
  data: Record<string, unknown> | null;
  errors: string[];
}

export type ToolInput = Record<string, unknown>;
export type ToolOutput = Record<string, unknown>;

export interface PDFExtractResult {
  title: string;
  pages: number;
  text: string;
}

export interface TableExtractResult {
  tableName: string;
  columns: string[];
  rows: Array<Record<string, string>>;
}

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

export interface ContactEntity {
  name: string;
  role: string;
  email: string;
  linkedin: string;
  organization: string;
  source?: string;
}

export interface CommodityDataRow {
  commodity: string;
  price: number | null;
  daily_volume: number | null;
  market_liquidity: number | null;
  volatility: number | null;
  exchange: string;
  source: string;
  collateral_score: number;
}

export type DomainType = 'news' | 'company' | 'exchange' | 'research' | 'government' | 'blog' | 'unknown';

export interface RankedSource {
  source: string;
  category: string;
  credibility: number;
  coverage: number;
  domain_type: string;
  score: number;
  identity: string;
}

export interface ToolAdapter {
  toolId: string;
  action: string;
  execute(input: ToolInput): Promise<ToolOutput>;
}
