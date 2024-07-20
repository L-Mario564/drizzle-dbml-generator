import { formatList, wrapColumnNames, wrapColumns } from '~/utils';
import { DBML } from '~/dbml';
import {
  One,
  Relations,
  SQL,
  createMany,
  createOne,
  getTableColumns,
  is,
  Table,
  Column
} from 'drizzle-orm';
import {
  AnyInlineForeignKeys,
  ExtraConfigBuilder,
  ExtraConfigColumns,
  Schema,
  TableName
} from '~/symbols';
import {
  ForeignKey as PgForeignKey,
  Index as PgIndex,
  PgEnum,
  PrimaryKey as PgPrimaryKey,
  UniqueConstraint as PgUniqueConstraint,
  isPgEnum,
  PgTable
} from 'drizzle-orm/pg-core';
import {
  ForeignKey as MySqlForeignKey,
  Index as MySqlIndex,
  PrimaryKey as MySqlPrimaryKey,
  MySqlTable,
  UniqueConstraint as MySqlUniqueConstraint
} from 'drizzle-orm/mysql-core';
import {
  ForeignKey as SQLiteForeignKey,
  Index as SQLiteIndex,
  PrimaryKey as SQLitePrimaryKey,
  SQLiteTable,
  UniqueConstraint as SQLiteUniqueConstraint
} from 'drizzle-orm/sqlite-core';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type {
  PgInlineForeignKeys,
  MySqlInlineForeignKeys,
  SQLiteInlineForeignKeys
} from '~/symbols';
import type { AnyColumn, BuildQueryConfig } from 'drizzle-orm';
import type { AnyBuilder, AnySchema, AnyTable } from '~/types';

export abstract class BaseGenerator<
  Schema extends AnySchema = AnySchema,
  Column extends AnyColumn = AnyColumn
> {
  private readonly schema: Schema;
  private readonly relational: boolean;
  private generatedRefs: string[] = [];
  protected InlineForeignKeys:
    | typeof AnyInlineForeignKeys
    | typeof PgInlineForeignKeys
    | typeof MySqlInlineForeignKeys
    | typeof SQLiteInlineForeignKeys = AnyInlineForeignKeys;
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
    } else if (value instanceof Date) {
      str = `'${value.toISOString().replace('T', ' ').replace('Z', '')}'`;
    } else if (is(value, SQL)) {
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
      .escapeType(column.getSQLType());
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

    if (column.default !== undefined) {
      constraints.push(`default: ${this.mapDefaultValue(column.default)}`);
    }

    if (constraints.length > 0) {
      dbml.insert(` [${formatList(constraints, this.buildQueryConfig.escapeName)}]`);
    }

    return dbml.build();
  }

  protected generateTable(table: AnyTable) {
    if (!this.relational) {
      this.generateForeignKeys(table[this.InlineForeignKeys as typeof AnyInlineForeignKeys]);
    }

    const dbml = new DBML().insert('table ');

    if (table[Schema]) {
      dbml.escapeSpaces(table[Schema]).insert('.');
    }

    dbml.escapeSpaces(table[TableName]).insert(' {').newLine();

    const columns = getTableColumns(table as unknown as Table);
    for (const columnName in columns) {
      const column = columns[columnName];
      const columnDBML = this.generateColumn(column as Column);
      dbml.insert(columnDBML).newLine();
    }
    const extraConfigBuilder = table[ExtraConfigBuilder];
    const extraConfigColumns = table[ExtraConfigColumns];
    const extraConfig = extraConfigBuilder?.(extraConfigColumns ?? {});

    const builtIndexes = Object.values(extraConfig ?? {}).map((b: AnyBuilder) => b.build(table));
    const fks = builtIndexes.filter(
      (index) =>
        is(index, PgForeignKey) || is(index, MySqlForeignKey) || is(index, SQLiteForeignKey)
    ) as unknown as (PgForeignKey | MySqlForeignKey | SQLiteForeignKey)[];

    if (!this.relational) {
      this.generateForeignKeys(fks);
    }

    if (extraConfigBuilder && builtIndexes.length > fks.length) {
      const indexes = extraConfig;

      dbml.newLine().tab().insert('indexes {').newLine();

      for (const indexName in indexes) {
        const index = indexes[indexName].build(table);
        dbml.tab(2);

        if (is(index, PgIndex) || is(index, MySqlIndex) || is(index, SQLiteIndex)) {
          const configColumns = index.config.columns.flatMap((entry) =>
            is(entry, SQL) ? entry.queryChunks.filter((v) => is(v, Column)) : (entry as Column)
          );

          const idxColumns = wrapColumns(
            configColumns as AnyColumn[],
            this.buildQueryConfig.escapeName
          );
          const idxProperties = index.config.name
            ? ` [name: '${index.config.name}'${index.config.unique ? ', unique' : ''}]`
            : '';
          dbml.insert(`${idxColumns}${idxProperties}`);
        }

        if (is(index, PgPrimaryKey) || is(index, MySqlPrimaryKey) || is(index, SQLitePrimaryKey)) {
          const pkColumns = wrapColumns(index.columns, this.buildQueryConfig.escapeName);
          dbml.insert(`${pkColumns} [pk]`);
        }

        if (
          is(index, PgUniqueConstraint) ||
          is(index, MySqlUniqueConstraint) ||
          is(index, SQLiteUniqueConstraint)
        ) {
          const uqColumns = wrapColumns(index.columns, this.buildQueryConfig.escapeName);
          const uqProperties = index.name ? `[name: '${index.name}', unique]` : '[unique]';
          dbml.insert(`${uqColumns} ${uqProperties}`);
        }

        dbml.newLine();
      }

      dbml.tab().insert('}').newLine();
    }

    dbml.insert('}');
    return dbml.build();
  }

  protected generateEnum(_enum_: PgEnum<[string, ...string[]]>) {
    return '';
  }

  private generateForeignKeys(fks: (PgForeignKey | MySqlForeignKey | SQLiteForeignKey)[]) {
    for (let i = 0; i < fks.length; i++) {
      const dbml = new DBML()
        .insert(`ref ${fks[i].getName()}: `)
        .escapeSpaces((fks[i].table as unknown as AnyTable)[TableName])
        .insert('.')
        .insert(wrapColumns(fks[i].reference().columns, this.buildQueryConfig.escapeName))
        .insert(' > ')
        .escapeSpaces((fks[i].reference().foreignTable as unknown as AnyTable)[TableName])
        .insert('.')
        .insert(wrapColumns(fks[i].reference().foreignColumns, this.buildQueryConfig.escapeName));

      const actions: string[] = [
        `delete: ${fks[i].onDelete || 'no action'}`,
        `update: ${fks[i].onUpdate || 'no action'}`
      ];
      const actionsStr = ` [${formatList(actions, this.buildQueryConfig.escapeName)}]`;

      dbml.insert(actionsStr);
      this.generatedRefs.push(dbml.build());
    }
  }

  private generateRelations(relations_: Relations[]) {
    const left: Record<
      string,
      {
        type: 'one' | 'many';
        sourceTable?: string;
        sourceColumns?: string[];
        foreignTable?: string;
        foreignColumns?: string[];
      }
    > = {};
    const right: typeof left = {};

    for (let i = 0; i < relations_.length; i++) {
      const relations = relations_[i].config({
        one: createOne(relations_[i].table),
        many: createMany(relations_[i].table)
      });

      for (const relationName in relations) {
        const relation = relations[relationName];
        const tableNames: string[] = [
          (relations_[i].table as unknown as AnyTable)[TableName],
          relation.referencedTableName
        ].sort();
        const key = `${tableNames[0]}-${tableNames[1]}${
          relation.relationName ? `-${relation.relationName}` : ''
        }`;

        if ((is(relation, One) && relation.config?.references.length) || 0 > 0) {
          left[key] = {
            type: 'one',
            sourceTable: (relation.sourceTable as unknown as AnyTable)[TableName],
            sourceColumns: (relation as One).config?.fields.map((col) => col.name) || [],
            foreignTable: relation.referencedTableName,
            foreignColumns: (relation as One).config?.references.map((col) => col.name) || []
          };
        } else {
          right[key] = {
            type: is(relation, One) ? 'one' : 'many'
          };
        }
      }
    }

    for (const key in left) {
      const sourceTable = left[key].sourceTable || '';
      const foreignTable = left[key].foreignTable || '';
      const sourceColumns = left[key].sourceColumns || [];
      const foreignColumns = left[key].foreignColumns || [];
      const relationType = right[key]?.type || 'one';

      if (sourceColumns.length === 0 || foreignColumns.length === 0) {
        throw Error(
          `Not enough information was provided to create relation between "${sourceTable}" and "${foreignTable}"`
        );
      }

      const dbml = new DBML()
        .insert('ref: ')
        .escapeSpaces(sourceTable)
        .insert('.')
        .insert(wrapColumnNames(sourceColumns, this.buildQueryConfig.escapeName))
        .insert(` ${relationType === 'one' ? '-' : '>'} `)
        .escapeSpaces(foreignTable)
        .insert('.')
        .insert(wrapColumnNames(foreignColumns, this.buildQueryConfig.escapeName))
        .build();

      this.generatedRefs.push(dbml);
    }
  }

  public generate() {
    const generatedEnums: string[] = [];
    const generatedTables: string[] = [];
    const relations: Relations[] = [];

    for (const key in this.schema) {
      const value = this.schema[key];

      if (isPgEnum(value)) {
        generatedEnums.push(this.generateEnum(value));
      } else if (is(value, PgTable) || is(value, MySqlTable) || is(value, SQLiteTable)) {
        generatedTables.push(this.generateTable(value as unknown as AnyTable));
      } else if (is(value, Relations)) {
        relations.push(value);
      }
    }

    if (this.relational) {
      this.generateRelations(relations);
    }

    const dbml = new DBML()
      .concatAll(generatedEnums)
      .concatAll(generatedTables)
      .concatAll(this.generatedRefs)
      .build();

    return dbml;
  }
}

export function writeDBMLFile(dbml: string, outPath: string) {
  const path = resolve(process.cwd(), outPath);

  try {
    writeFileSync(path, dbml, { encoding: 'utf-8' });
  } catch (err) {
    console.error('An error ocurred while writing the generated DBML');
    throw err;
  }
}
