import { formatList } from '.'; 
import type { AnyColumn } from 'drizzle-orm';

export function wrapColumns(columns: AnyColumn[]) {
  return columns.length === 1
    ? columns[0].name
    : `(${formatList(columns.map((column) => column.name), true)})`;
}

export function wrapColumnNames(columns: string[]) {
  return columns.length === 1 ? columns[0] : `(${formatList(columns)})`;
}
