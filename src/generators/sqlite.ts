import { BaseGenerator, writeDBMLFile } from './common';
import { SQLiteInlineForeignKeys } from '~/symbols';
import { is, SQL } from 'drizzle-orm';
import { SQLiteBaseInteger } from 'drizzle-orm/sqlite-core';
import type { BuildQueryConfig } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { SQLiteSchema, Options } from '~/types';

class SQLiteGenerator extends BaseGenerator<SQLiteSchema, AnySQLiteColumn> {
  protected override InlineForeignKeys: typeof SQLiteInlineForeignKeys = SQLiteInlineForeignKeys;
  protected override buildQueryConfig: BuildQueryConfig = {
    escapeName: (name) => `"${name}"`,
    escapeParam: (_num) => '?',
    escapeString: (str) => `'${str.replace(/'/g, "''")}'`
  };

  protected override isIncremental(column: AnySQLiteColumn) {
    return is(column, SQLiteBaseInteger) && column.autoIncrement;
  }

  protected mapDefaultValue(value: unknown) {
    let str = '';

    if (typeof value === 'string') {
      str = `'${value}'`;
    } else if (typeof value === 'boolean') {
      str = `${value ? 1 : 0}`;
    } else if (typeof value === 'number') {
      str = `${value}`;
    } else if (value === null) {
      str = 'null';
    } else if (is(value, SQL)) {
      str = `\`${value.toQuery(this.buildQueryConfig).sql}\``;
    } else {
      str = `\`${JSON.stringify(value)}\``;
    }

    return str;
  }
}

export function sqliteGenerate<T>(options: Options<T>) {
  options.relational ||= false;
  const dbml = new SQLiteGenerator(options.schema as SQLiteSchema, options.relational).generate();
  writeDBMLFile(dbml, options.out);
}
