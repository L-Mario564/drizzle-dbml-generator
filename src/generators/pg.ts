import { Relations } from 'drizzle-orm';
import { InlineForeignKeys, Schema, TableName, isPgEnumSym } from '~/symbols';
import { DBML } from '~/dbml';
import { PgTable } from 'drizzle-orm/pg-core';
import type { AnyPgColumn, PgEnum } from 'drizzle-orm/pg-core';
import type { PgSchema, AnyPgTable } from '~/types';

// TODO: Constraints
function generateColumn(column: AnyPgColumn) {
  const dbml = new DBML()
    .tab()
    .escapeSpaces(column.name)
    .insert(' ')
    .escapeSpaces(column.getSQLType());
  return dbml.build();
}

// TODO: Indexes
function generateTable(table: AnyPgTable) {
  const dbml = new DBML().insert('table ');

  if (table[Schema]) {
    dbml.escapeSpaces(table[Schema]).insert('.');
  }

  dbml
    .escapeSpaces(table[TableName])
    .insert(' {')
    .newLine();

  for (const columnName in table) {
    const column = table[columnName as keyof typeof table] as AnyPgColumn;
    const columnDBML = generateColumn(column);
    dbml.insert(columnDBML).newLine();
  }
  
  dbml.insert('}');
  return dbml.build();
}

function generateEnum(dbEnum: PgEnum<[string, ...string[]]>) {
  const dbml = new DBML()
    .insert('enum ')
    .escapeSpaces(dbEnum.enumName)
    .insert(' {')
    .newLine();
  
  for (let i = 0; i < dbEnum.enumValues.length; i++) {
    dbml
      .tab()
      .escapeSpaces(dbEnum.enumValues[i])
      .newLine();
  }

  dbml.insert('}');
  return dbml.build();
}

function isPgEnum(obj: unknown): obj is PgEnum<[string, ...string[]]> {
  return !!obj && typeof obj === 'function' && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}

export function pgGenerator(schema: PgSchema) {
  const generatedEnums: string[] = [];
  const generatedTables: string[] = [];

  for (const key in schema) {
    const value = schema[key];

    if (isPgEnum(value)) {
      generatedEnums.push(generateEnum(value));
    } else if (value instanceof PgTable) {
      generatedTables.push(generateTable(value));
    }
  }

  const dbml = new DBML();

  for (let i = 0; i < generatedEnums.length; i++) {
    dbml.insert(generatedEnums[i]).newLine(2);
  }

  for (let i = 0; i < generatedTables.length; i++) {
    dbml.insert(generatedTables[i]).newLine(2);
  }

  return dbml.build();
}