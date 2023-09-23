import { BaseGenerator, writeDBMLFile } from './common';
import { is } from 'drizzle-orm';
import { MySqlColumnWithAutoIncrement } from 'drizzle-orm/mysql-core';
import { MySqlInlineForeignKeys } from '~/symbols';
import type { BuildQueryConfig } from 'drizzle-orm';
import type { AnyMySqlColumn } from 'drizzle-orm/mysql-core';
import type { MySqlSchema, Options } from '~/types';

class MySqlGenerator extends BaseGenerator<MySqlSchema, AnyMySqlColumn> {
  protected override InlineForeignKeys: typeof MySqlInlineForeignKeys = MySqlInlineForeignKeys;
  protected override buildQueryConfig: BuildQueryConfig = {
    escapeName: (name) => `\`${name}\``,
    escapeParam: (_num) => '?',
    escapeString: (str) => `'${str.replace(/'/g, "''")}'`
  };

  protected override isIncremental(column: AnyMySqlColumn) {
    return (
      column.getSQLType().includes('serial') ||
      (is(column, MySqlColumnWithAutoIncrement) && column.autoIncrement)
    );
  }
}

export function mysqlGenerate<T>(options: Options<T>) {
  options.relational ||= false;
  const dbml = new MySqlGenerator(options.schema as MySqlSchema, options.relational).generate();
  writeDBMLFile(dbml, options.out);
}
