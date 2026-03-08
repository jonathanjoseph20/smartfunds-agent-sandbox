function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeader(value: string): string {
  const cleaned = stripTags(value).toLowerCase();
  return cleaned
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseCells(rowHtml: string, tag: 'th' | 'td'): string[] {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return [...rowHtml.matchAll(pattern)].map((entry) => stripTags(entry[1] ?? ''));
}

function parseRows(tableHtml: string): string[][] {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((entry) => entry[1] ?? '');
  return rows
    .map((rowHtml) => {
      const headers = parseCells(rowHtml, 'th');
      if (headers.length > 0) {
        return headers;
      }
      return parseCells(rowHtml, 'td');
    })
    .filter((cells) => cells.length > 0);
}

export interface TableExtractResult {
  tableName: string;
  columns: string[];
  rows: Array<Record<string, string>>;
}

export function tableExtract(input: { html: string }): { tables: TableExtractResult[] } {
  const tables = [...input.html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((entry) => entry[1] ?? '')
    .map((tableHtml, tableIndex) => {
      const rowMatrix = parseRows(tableHtml);
      if (rowMatrix.length === 0) {
        return null;
      }

      const rawColumns = rowMatrix[0];
      const columns = rawColumns.map((column, columnIndex) => {
        const normalized = normalizeHeader(column);
        return normalized.length > 0 ? normalized : `column_${columnIndex + 1}`;
      });

      const bodyRows = rowMatrix.slice(1).map((cells) => {
        const row: Record<string, string> = {};
        for (let i = 0; i < columns.length; i += 1) {
          row[columns[i]] = (cells[i] ?? '').trim();
        }
        return row;
      });

      return {
        tableName: `table_${tableIndex + 1}`,
        columns,
        rows: bodyRows
      };
    })
    .filter((entry): entry is TableExtractResult => entry !== null);

  return { tables };
}
