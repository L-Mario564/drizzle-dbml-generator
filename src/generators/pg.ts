import { DBML } from '~/dbml';
import { BaseGenerator } from './common';
import type { BuildQueryConfig } from 'drizzle-orm';
import type { AnyPgColumn, PgEnum } from 'drizzle-orm/pg-core';
import type { PgSchema, AnySchema, AnyTable } from '~/types';

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

export function pgGenerator(schema: AnySchema, relational: boolean = false) {
  return new PgGenerator(schema, relational).generate();
}
