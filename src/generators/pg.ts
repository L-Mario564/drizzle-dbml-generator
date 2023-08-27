import { SQL } from 'drizzle-orm';
import { DBML } from '~/dbml';
import { BaseGenerator } from './common';
import type { BuildQueryConfig } from 'drizzle-orm';
import type { AnyPgColumn, PgEnum } from 'drizzle-orm/pg-core';
import type { PgSchema, AnyTable } from '~/types';

class PgGenerator extends BaseGenerator<PgSchema, AnyTable, AnyPgColumn> {
  protected override buildQueryConfig: BuildQueryConfig = {
    escapeName: (name) => `"${name}"`,
    escapeParam: (num) => `$${num + 1}`,
    escapeString: (str) => `'${str.replace(/'/g, "''")}'`
  };

  protected override isIncremental(column: AnyPgColumn) {
    return column.getSQLType().includes('serial');
  }

  protected mapDefaultValue(value: unknown) {
    let str = '';

    if (typeof value === 'string') {
      str = `'${value}'`;
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      str = `${value}`;
    } else if (value === null) {
      str = 'null';
    } else if (value instanceof SQL) {
      str = `\`${value.toQuery(this.buildQueryConfig).sql}\``;
    } else {
      str = `\`${JSON.stringify(value)}\``;
    }

    return str;
  }

  protected override generateEnum(enum_: PgEnum<[string, ...string[]]>) {
    const dbml = new DBML()
      .insert('enum ')
      .escapeSpaces(enum_.enumName)
      .insert(' {')
      .newLine();
    
    for (let i = 0; i < enum_.enumValues.length; i++) {
      dbml
        .tab()
        .escapeSpaces(enum_.enumValues[i])
        .newLine();
    }
  
    dbml.insert('}');
    return dbml.build();
  }
}

export function pgGenerator(schema: PgSchema) {
  return new PgGenerator().generate(schema);
}