import type { AnyColumn, AnyTable as DrizzleAnyTable, Relations } from 'drizzle-orm';
import type { ForeignKey, Index, PgEnum, PrimaryKey, UniqueConstraint } from 'drizzle-orm/pg-core';
import type { AnyInlineForeignKeys, TableName, Schema as SchemaSymbol, ExtraConfigBuilder } from './symbols';

export type AnyTable = DrizzleAnyTable['_']['columns'] & {
  [AnyInlineForeignKeys]: ForeignKey[];
  [TableName]: string;
  [SchemaSymbol]: string | undefined;
  [ExtraConfigBuilder]:
    | ((self: Record<string, AnyColumn>) => Record<string, AnyBuilder>)
    | undefined;
};

export type AnyBuilder = {
  build: (table: AnyTable) => UniqueConstraint | PrimaryKey | ForeignKey | Index;
};
export type Options<Schema> = {
  schema: Schema;
  out: string;
  relational?: boolean;
};

type Schema<DialectTypes = NonNullable<unknown>> = Record<
  string,
  DialectTypes | Relations | AnyTable | DrizzleAnyTable
>;
export type AnySchema = Schema;
export type PgSchema = Schema<PgEnum<[string, ...string[]]>>;
export type MySqlSchema = Schema;
