import { formatList } from '~/utils';
import { DBML } from '~/dbml';
import { Relations } from 'drizzle-orm';
import { ExtraConfigBuilder, InlineForeignKeys, Schema, TableName } from '~/symbols';
import { ForeignKey, Index, PgEnum, PrimaryKey, UniqueConstraint, isPgEnum } from 'drizzle-orm/pg-core';
import type { AnyColumn, BuildQueryConfig } from 'drizzle-orm';
import type { AnySchema, AnyTable } from '~/types';

export abstract class BaseGenerator<
  Schema extends AnySchema = AnySchema,
  Table extends AnyTable = AnyTable,
  Column extends AnyColumn = AnyColumn
> {
  protected buildQueryConfig: BuildQueryConfig = {
    escapeName: () => '',
    escapeParam: () => '',
    escapeString: () => ''
  };

  protected isIncremental(_column: Column) {
    return false;
  }

  protected mapDefaultValue(_value: unknown) {
    return '';
  }

  protected generateColumn(column: Column, fk?: ForeignKey) {
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

    if (this.isIncremental(column)) {
      constraints.push('increment');
    }

    if (column.default) {
      constraints.push(`default: ${this.mapDefaultValue(column.default)}`);
    }

    if (fk) {
      const foreignColumn = fk.reference().foreignColumns[0];
      const foreignTable = foreignColumn.table as unknown as Table;
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

  protected generateTable(table: Table) {
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
      const column = table[columnName] as unknown as Column;
      const inlineFk = fks.find((fk) => fk.reference().columns.at(0)?.name === column.name);
  
      const columnDBML = this.generateColumn(column, inlineFk);
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

  protected generateEnum(_enum_: PgEnum<[string, ...string[]]>) {
    return '';
  };

  public generate(schema: Schema) {
    const generatedEnums: string[] = [];
    const generatedTables: string[] = [];

    for (const key in schema) {
      const value = schema[key];

      if (isPgEnum(value)) {
        generatedEnums.push(this.generateEnum(value));
      } else if (!(value instanceof Relations)) {
        generatedTables.push(this.generateTable(value as unknown as Table));
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
  };
}
