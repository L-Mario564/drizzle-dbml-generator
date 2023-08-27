import type { getCliOptions } from '~/utils';
import type { Relations } from 'drizzle-orm';
import type { Check, AnyPgTable as DrizzleAnyPgTable, ForeignKey, Index, PgColumn, PgEnum, PrimaryKey, UniqueConstraint } from 'drizzle-orm/pg-core';
// import type { MySqlTable } from 'drizzle-orm/mysql-core';
// import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { InlineForeignKeys, TableName, Schema, ExtraConfigBuilder } from './symbols';

type Schema<DialectTypes> = Record<string, DialectTypes | Relations>;

export type AnyPgTable = DrizzleAnyPgTable['_']['columns'] & {
  [InlineForeignKeys]: ForeignKey[];
  [TableName]: string;
  [Schema]: string | undefined;
  [ExtraConfigBuilder]: ((self: Record<string, PgColumn>) => Record<string, {
    build: (table: AnyPgTable) => UniqueConstraint | PrimaryKey | ForeignKey | Check | Index
  }>) | undefined;
};

export type PgSchema = Schema<AnyPgTable | PgEnum<[string, ...string[]]>>;
// export type MySqlSchema = Schema<MySqlTable>;
// export type SQLiteSchema = Schema<SQLiteTable>;
export type Options = ReturnType<typeof getCliOptions>;
