import { formatList, wrapColumns } from '~/utils';
import { DBML } from '~/dbml';
import { Relations, SQL } from 'drizzle-orm';
import { ExtraConfigBuilder, InlineForeignKeys, Schema, TableName } from '~/symbols';
import { ForeignKey, Index, PgEnum, PrimaryKey, UniqueConstraint, isPgEnum } from 'drizzle-orm/pg-core';
import type { AnyColumn, BuildQueryConfig } from 'drizzle-orm';
import type { AnyBuilder, AnySchema, AnyTable } from '~/types';

export abstract class BaseGenerator<
  Schema extends AnySchema = AnySchema,
  Table extends AnyTable = AnyTable,
  Column extends AnyColumn = AnyColumn
> {
  private readonly schema: Schema;
  private readonly relational: boolean;
  private generatedRefs: string[] = [];
  protected buildQueryConfig: BuildQueryConfig = {
    escapeName: () => '',
    escapeParam: () => '',
    escapeString: () => ''
  };

  constructor(schema: Schema, relational: boolean) {
    this.schema = schema;
    this.relational = relational;
  }

  protected isIncremental(_column: Column) {
    return false;
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

  protected generateColumn(column: Column) {
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

    // if (fk) {
    //   const foreignColumn = fk.reference().foreignColumns[0];
    //   const foreignTable = foreignColumn.table as unknown as Table;
    //   const schema = foreignTable[Schema] ? `${foreignTable[Schema]}.` : '';
    //   const refStr = `ref: > ${schema}${foreignTable[TableName]}.${foreignColumn.name}`;
    //   const actions: string[] = [];
    //   let actionsStr = '';

    //   if (fk.onDelete) {
    //     actions.push(`delete: ${fk.onDelete}`);
    //   }

    //   if (fk.onUpdate) {
    //     actions.push(`update: ${fk.onUpdate}`);
    //   }

    //   if (actions.length > 0) {
    //     actionsStr = `, note: 'actions: [${formatList(actions)}]'`;
    //   }

    //   constraints.push(`${refStr}${actionsStr}`);
    // }

    if (constraints.length > 0) {
      dbml.insert(` [${formatList(constraints)}]`);
    }

    return dbml.build();
  }

  protected generateTable(table: Table) {
    if (!this.relational) {
      this.generateForeignKeys(table[InlineForeignKeys]);
    }

    const dbml = new DBML().insert('table ');
  
    if (table[Schema]) {
      dbml.escapeSpaces(table[Schema]).insert('.');
    }
  
    dbml
      .escapeSpaces(table[TableName])
      .insert(' {')
      .newLine();
  
    for (const columnName in table) {
      const column = table[columnName] as unknown as Column;
      const columnDBML = this.generateColumn(column);
      dbml.insert(columnDBML).newLine();
    }

    const extraConfig = table[ExtraConfigBuilder];
    const builtIndexes = Object
      .values(table[ExtraConfigBuilder]?.(table) || {})
      .map((b: AnyBuilder) => b.build(table));
    const fks = builtIndexes.filter((index) => index instanceof ForeignKey) as unknown as ForeignKey[];
    this.generateForeignKeys(fks);

    if (extraConfig && builtIndexes.length > fks.length) {
      const indexes = extraConfig(table);
  
      dbml
        .newLine()
        .tab()
        .insert('indexes {')
        .newLine();
  
      for (const indexName in indexes) {
        const index = indexes[indexName].build(table);
        dbml.tab(2);
  
        if (index instanceof Index) {
          const idxColumns = wrapColumns(index.config.columns);
          const idxProperties = index.config.name ?
            ` [name: '${index.config.name}'${index.config.unique ? ', unique' : ''}]`
            : '';
          dbml.insert(`${idxColumns}${idxProperties}`);
        }
  
        if (index instanceof PrimaryKey) {
          const pkColumns = wrapColumns(index.columns);
          dbml.insert(`${pkColumns} [pk]`);
        }
  
        if (index instanceof UniqueConstraint) {
          const uqColumns = wrapColumns(index.columns);
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

  private generateForeignKeys(fks: ForeignKey[]) {
    for (let i = 0; i < fks.length; i++) {
      const dbml = new DBML()
        .insert(`ref ${fks[i].getName()}: `)
        .escapeSpaces((fks[i].table as unknown as Table)[TableName])
        .insert('.')
        .insert(wrapColumns(fks[i].reference().columns))
        .insert(' > ')
        .escapeSpaces((fks[i].reference().foreignTable as unknown as Table)[TableName])
        .insert('.')
        .insert(wrapColumns(fks[i].reference().foreignColumns));

      const actions: string[] = [];
      let actionsStr = '';

      if (fks[i].onDelete) {
        actions.push(`delete: ${fks[i].onDelete}`);
      }

      if (fks[i].onUpdate) {
        actions.push(`update: ${fks[i].onUpdate}`);
      }

      if (actions.length > 0) {
        actionsStr = ` [${formatList(actions)}]`;
      }

      dbml.insert(actionsStr);
      this.generatedRefs.push(dbml.build());
    }
  }

  public generate() {
    const generatedEnums: string[] = [];
    const generatedTables: string[] = [];

    for (const key in this.schema) {
      const value = this.schema[key];

      if (isPgEnum(value)) {
        generatedEnums.push(this.generateEnum(value));
      } else if (!(value instanceof Relations)) {
        generatedTables.push(this.generateTable(value as unknown as Table));
      }
    }

    const dbml = new DBML()
      .concatAll(generatedEnums)
      .concatAll(generatedTables)
      .concatAll(this.generatedRefs)
      .build();

    return dbml;
  };
}
