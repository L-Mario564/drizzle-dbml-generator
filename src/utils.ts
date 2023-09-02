import path from 'path';
import { fileURLToPath } from 'url';
import type { AnyColumn } from 'drizzle-orm';

export function definePath(...paths: string[]) {
  const __filename = fileURLToPath(import.meta.url);
  const distPath = path.dirname(__filename);
  return path.join(distPath, ...paths);
}

export function formatList(items: string[], escapeSpaces: boolean = false) {
  return items
    .reduce((str, item) => `${str}, ${escapeSpaces && item.includes(' ') ? `"${item}"` : item}`, '')
    .slice(2);
}

export function wrapColumns(columns: AnyColumn[]) {
  const formatted = formatList(
    columns.map((column) => column.name),
    true
  );
  return columns.length === 1 ? columns[0].name : `(${formatted})`;
}

export function wrapColumnNames(columns: string[]) {
  return columns.length === 1 ? columns[0] : `(${formatList(columns)})`;
}
