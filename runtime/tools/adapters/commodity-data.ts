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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.replace(/[$,%\s,]/g, '');
  if (cleaned.length === 0) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreCollateral(row: Omit<CommodityDataRow, 'collateral_score'>): number {
  const liquidity = row.market_liquidity ?? 0;
  const volume = row.daily_volume ?? 0;
  const volatility = row.volatility ?? 0;

  const score = (liquidity * 0.5) + (volume * 0.3) - (volatility * 0.2);
  return Math.round(score * 100) / 100;
}

function normalizeRow(input: Record<string, unknown>): CommodityDataRow {
  const commodity = normalizeWhitespace(String(input.commodity ?? ''));
  const price = parseNumber(input.price);
  const dailyVolume = parseNumber(input.daily_volume ?? input.dailyVolume);
  const marketLiquidity = parseNumber(input.market_liquidity ?? input.marketLiquidity);
  const volatility = parseNumber(input.volatility);
  const exchange = normalizeWhitespace(String(input.exchange ?? ''));
  const source = normalizeWhitespace(String(input.source ?? ''));

  const rowWithoutScore = {
    commodity,
    price,
    daily_volume: dailyVolume,
    market_liquidity: marketLiquidity,
    volatility,
    exchange,
    source
  };

  return {
    ...rowWithoutScore,
    collateral_score: scoreCollateral(rowWithoutScore)
  };
}

export function commodityData(input: {
  rows?: Array<Record<string, unknown>>;
}): { rows: CommodityDataRow[] } {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const normalized = rows
    .map((row) => normalizeRow(row))
    .filter((row) => row.commodity.length > 0)
    .sort((left, right) => {
      const commodityCompare = left.commodity.localeCompare(right.commodity);
      if (commodityCompare !== 0) {
        return commodityCompare;
      }
      return left.source.localeCompare(right.source);
    });

  return { rows: normalized };
}
