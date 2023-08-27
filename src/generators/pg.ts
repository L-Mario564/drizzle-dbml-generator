import { Relations, SQL } from 'drizzle-orm';
import { ExtraConfigBuilder, InlineForeignKeys, Schema, TableName, isPgEnumSym } from '~/symbols';
import { DBML } from '~/dbml';
import { Index, PrimaryKey, UniqueConstraint } from 'drizzle-orm/pg-core';
import { formatList } from '~/utils';
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
    const refStr = `ref: > ${schema}${foreignTable[TableName]}.${foreignColumn.name}`;
    const actions: string[] = [];
    let actionsStr = '';

    if (fk.onDelete) {
      actions.push(`delete: ${fk.onDelete}`);
    }

    if (fk.onUpdate) {
      actions.push(`update: ${fk.onUpdate}`);
    }

    if (actions.length > 0) {
      actionsStr = `, note: 'actions: [${formatList(actions)}]'`;
    }

    constraints.push(`${refStr}${actionsStr}`);
  }

  if (constraints.length > 0) {
    dbml.insert(` [${formatList(constraints)}]`);
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

  if (table[ExtraConfigBuilder]) {
    const indexes = table[ExtraConfigBuilder](table);

    dbml
      .newLine()
      .tab()
      .insert('indexes {')
      .newLine();

    for (const indexName in indexes) {
      const index = indexes[indexName].build(table);
      dbml.tab(2);

      if (index instanceof Index) {
        const idxColumns = index.config.columns.length === 1
          ? index.config.columns[0].name
          : `(${formatList(index.config.columns.map((column) => column.name))})`;
        const idxProperties = index.config.name ?
          ` [name: '${index.config.name}'${index.config.unique ? ', unique' : ''}]`
          : '';
        dbml.insert(`${idxColumns}${idxProperties}`);
      }

      if (index instanceof PrimaryKey) {
        const pkColumns = index.columns.length === 1
          ? index.columns[0].name
          : `(${formatList(index.columns.map((column) => column.name))})`;
        dbml.insert(`${pkColumns} [pk]`);
      }

      if (index instanceof UniqueConstraint) {
        const uqColumns = index.columns.length === 1
          ? index.columns[0].name
          : `(${formatList(index.columns.map((column) => column.name))})`;
        const uqProperties = index.name
          ? `[name: '${index.name}', unique]`
          : '[unique]';
        dbml.insert(`${uqColumns} ${uqProperties}`);
      }
  
      dbml.newLine();
    }

    dbml
      .tab()
      .insert('}')
      .newLine();
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