import { DBML } from '~/dbml';
import { BaseGenerator, writeDBMLFile } from './common';
import type { BuildQueryConfig } from 'drizzle-orm';
import type { AnyPgColumn, PgEnum } from 'drizzle-orm/pg-core';
import type { PgSchema, AnyTable, Options } from '~/types';

class PgGenerator extends BaseGenerator<PgSchema, AnyTable, AnyPgColumn> {
  protected override buildQueryConfig: BuildQueryConfig = {
    escapeName: (name) => `"${name}"`,
    escapeParam: (num) => `$${num + 1}`,
    escapeString: (str) => `'${str.replace(/'/g, "''")}'`
  };

  protected override isIncremental(column: AnyPgColumn) {
    return column.getSQLType().includes('serial');
  }

  protected override generateEnum(enum_: PgEnum<[string, ...string[]]>) {
    const dbml = new DBML().insert('enum ').escapeSpaces(enum_.enumName).insert(' {').newLine();

    for (let i = 0; i < enum_.enumValues.length; i++) {
      dbml.tab().escapeSpaces(enum_.enumValues[i]).newLine();
    }

    dbml.insert('}');
    return dbml.build();
  }
}

export function pgGenerate<T>(options: Options<T>) {
  options.relational ||= false;
  const dbml = new PgGenerator(options.schema as PgSchema, options.relational).generate();
  writeDBMLFile(dbml, options.out);
}
