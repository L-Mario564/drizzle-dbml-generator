import type { AnyColumn, BuildQueryConfig } from 'drizzle-orm';
import type { PgEnum } from 'drizzle-orm/pg-core';
import type { AnySchema, AnyTable } from './types';

export interface Generator<
  Schema extends AnySchema = AnySchema,
  Table extends AnyTable = AnyTable,
  Column extends AnyColumn = AnyColumn
> {
  buildQueryConfig: BuildQueryConfig;
  isIncremental: (column: Column) => boolean;
  mapDefaultValue: (value: unknown) => string;
  generateColumn: (value: Column) => string;
  generateTable: (table: Table) => string;
  generate: (schema: Schema) => string;
  generateEnum: (enum_: PgEnum<[string, ...string[]]>) => string;
}
