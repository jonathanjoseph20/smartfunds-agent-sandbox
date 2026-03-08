function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.replace(/\r\n?/g, '\n');
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function collectColumns(rows: Array<Record<string, unknown>>): string[] {
  const all = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      all.add(key);
    }
  }
  return [...all].sort((left, right) => left.localeCompare(right));
}

function stableRowSort(rows: Array<Record<string, unknown>>, columns: string[]): Array<Record<string, unknown>> {
  return [...rows].sort((left, right) => {
    const leftKey = columns.map((column) => normalizeCell(left[column])).join('\u0001');
    const rightKey = columns.map((column) => normalizeCell(right[column])).join('\u0001');
    return leftKey.localeCompare(rightKey);
  });
}

export function writeCsv(input: {
  rows: Array<Record<string, unknown>>;
  columns?: string[];
}): string {
  const columns = input.columns && input.columns.length > 0
    ? [...new Set(input.columns)].sort((left, right) => left.localeCompare(right))
    : collectColumns(input.rows);

  const sortedRows = stableRowSort(input.rows, columns);
  const lines = [
    columns.map(escapeCsv).join(','),
    ...sortedRows.map((row) => columns.map((column) => escapeCsv(normalizeCell(row[column]))).join(','))
  ];

  return `${lines.join('\n')}\n`;
}
