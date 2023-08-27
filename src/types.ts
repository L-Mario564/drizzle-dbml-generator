import type { getCliOptions } from '~/utils';
import type { AnyColumn, AnyTable as DrizzleAnyTable, Relations } from 'drizzle-orm';
import type { AnyPgTable as DrizzleAnyPgTable, ForeignKey, Index, PgColumn, PgEnum, PrimaryKey, UniqueConstraint } from 'drizzle-orm/pg-core';
// import type { MySqlTable } from 'drizzle-orm/mysql-core';
// import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { InlineForeignKeys, TableName, Schema, ExtraConfigBuilder } from './symbols';

export type AnyTable = DrizzleAnyTable['_']['columns'] & {
  [InlineForeignKeys]: ForeignKey[];
  [TableName]: string;
  [Schema]: string | undefined;
  [ExtraConfigBuilder]: ((self: Record<string, AnyColumn>) => Record<string, {
    build: (table: AnyTable) => UniqueConstraint | PrimaryKey | ForeignKey | Index
  }>) | undefined;
}

type Schema<DialectTypes> = Record<string, DialectTypes | Relations>;
export type AnySchema = Schema<AnyTable | PgEnum<[string, ...string[]]>>;

export type AnyPgTable = DrizzleAnyPgTable['_']['columns'] & {
  [InlineForeignKeys]: ForeignKey[];
  [TableName]: string;
  [Schema]: string | undefined;
  [ExtraConfigBuilder]: ((self: Record<string, PgColumn>) => Record<string, {
    build: (table: AnyPgTable) => UniqueConstraint | PrimaryKey | ForeignKey | Index
  }>) | undefined;
};

export type PgSchema = Schema<AnyTable | PgEnum<[string, ...string[]]>>;
// export type MySqlSchema = Schema<MySqlTable>;
// export type SQLiteSchema = Schema<SQLiteTable>;
export type Options = ReturnType<typeof getCliOptions>;
