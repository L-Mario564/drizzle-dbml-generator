import type { AnyColumn, Table, Relations } from 'drizzle-orm';
import type { ForeignKey, Index, PgEnum, PrimaryKey, UniqueConstraint } from 'drizzle-orm/pg-core';
import type {
  AnyInlineForeignKeys,
  TableName,
  Schema as SchemaSymbol,
  ExtraConfigBuilder,
  ExtraConfigColumns
} from './symbols';

export type AnyTable = Table['_']['columns'] & {
  [AnyInlineForeignKeys]: ForeignKey[];
  [TableName]: string;
  [SchemaSymbol]: string | undefined;
  [ExtraConfigBuilder]:
    | ((self: Record<string, AnyColumn>) => Record<string, AnyBuilder>)
    | undefined;
  [ExtraConfigColumns]: Record<string, AnyColumn> | undefined;
};

export type AnyBuilder = {
  build: (table: AnyTable) => UniqueConstraint | PrimaryKey | ForeignKey | Index;
};
export type Options<Schema> = {
  schema: Schema;
  out?: string;
  relational?: boolean;
};

type Schema<DialectTypes = NonNullable<unknown>> = Record<
  string,
  DialectTypes | Relations | AnyTable | Table
>;
export type AnySchema = Schema;
export type PgSchema = Schema<PgEnum<[string, ...string[]]>>;
export type MySqlSchema = Schema;
export type SQLiteSchema = Schema;
