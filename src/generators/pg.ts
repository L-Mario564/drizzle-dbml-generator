import { Relations, SQL } from 'drizzle-orm';
import { InlineForeignKeys, Schema, TableName, isPgEnumSym } from '~/symbols';
import { DBML } from '~/dbml';
import type { BuildQueryConfig } from 'drizzle-orm';
import type { AnyPgColumn, ForeignKey, PgEnum } from 'drizzle-orm/pg-core';
import type { PgSchema, AnyPgTable } from '~/types';

function generateColumn(column: AnyPgColumn, fk?: ForeignKey) {
  const dbml = new DBML()
    .tab()
    .escapeSpaces(column.name)
    .insert(' ')
    .escapeSpaces(column.getSQLType());
  const constraints: string[] = [];

  if (column.primary) {
    constraints.push('pk');
  }

  if (column.notNull) {
    constraints.push('not null');
  }

  if (column.isUnique) {
    constraints.push('unique');
  }

  if (column.getSQLType().includes('serial')) {
    constraints.push('increment');
  }

  if (column.default) {
    if (typeof column.default === 'string') {
      constraints.push(`default: '${column.default}'`);
    } else if (typeof column.default === 'boolean' || typeof column.default === 'number' || column.default === null) {
      constraints.push(`default: ${column.default}`);
    } else if (column.default instanceof SQL) {
      const queryConfig: BuildQueryConfig = {
        escapeName: (name) => `"${name}"`,
        escapeParam: (num) => `$${num + 1}`,
        escapeString: (str) => `'${str.replace(/'/g, "''")}'`
      };

      constraints.push(`default: \`${column.default.toQuery(queryConfig).sql}\``);
    } else {
      constraints.push(`default: \`${JSON.stringify(column.default)}\``);
    }
  }

  if (fk) {
    const foreignColumn = fk.reference().foreignColumns[0];
    const foreignTable = foreignColumn.table as unknown as AnyPgTable;
    const schema = foreignTable[Schema] ? `${foreignTable[Schema]}.` : '';
    constraints.push(`ref: > ${schema}${foreignTable[TableName]}.${foreignColumn.name}`);
  }

  if (constraints.length > 0) {
    const constraintsStr = constraints.reduce((str, constraint) => `${str}, ${constraint}`, '').slice(2);
    dbml.insert(` [${constraintsStr}]`);
  }
  
  return dbml.build();
}

// TODO: Indexes
function generateTable(table: AnyPgTable) {
  const dbml = new DBML().insert('table ');
  const fks = table[InlineForeignKeys];

  if (table[Schema]) {
    dbml.escapeSpaces(table[Schema]).insert('.');
  }

  dbml
    .escapeSpaces(table[TableName])
    .insert(' {')
    .newLine();

  for (const columnName in table) {
    const column = table[columnName as keyof typeof table] as AnyPgColumn;
    const inlineFk = fks.find((fk) => fk.reference().columns.at(0)?.name === column.name);

    const columnDBML = generateColumn(column, inlineFk);
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
    } else if (!(value instanceof Relations)) {
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