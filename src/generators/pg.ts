import { DBML } from '~/dbml';
import { BaseGenerator, writeDBMLFile } from './common';
import { PgInlineForeignKeys } from '~/symbols';
import type { BuildQueryConfig } from 'drizzle-orm';
import type { AnyPgColumn, PgEnum } from 'drizzle-orm/pg-core';
import type { PgSchema, Options } from '~/types';

class PgGenerator extends BaseGenerator<PgSchema, AnyPgColumn> {
  protected override InlineForeignKeys: typeof PgInlineForeignKeys = PgInlineForeignKeys;
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

export function pgGenerate<T>(options: Options<T>): string {
  options.relational ||= false;
  const dbml = new PgGenerator(options.schema as PgSchema, options.relational).generate();
  options.out && writeDBMLFile(dbml, options.out);
  return dbml;
}
