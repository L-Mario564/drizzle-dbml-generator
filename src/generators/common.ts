import { formatList, wrapColumnNames, wrapColumns } from '~/utils';
import { DBML } from '~/dbml';
import { One, Relations, SQL, createMany, createOne, is, isTable } from 'drizzle-orm';
import { ExtraConfigBuilder, InlineForeignKeys, Schema, TableName } from '~/symbols';
import {
  ForeignKey,
  Index,
  PgEnum,
  PrimaryKey,
  UniqueConstraint,
  isPgEnum
} from 'drizzle-orm/pg-core';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
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

    dbml.escapeSpaces(table[TableName]).insert(' {').newLine();

    for (const columnName in table) {
      const column = table[columnName] as unknown as Column;
      const columnDBML = this.generateColumn(column);
      dbml.insert(columnDBML).newLine();
    }

    const extraConfig = table[ExtraConfigBuilder];
    const builtIndexes = Object.values(table[ExtraConfigBuilder]?.(table) || {}).map(
      (b: AnyBuilder) => b.build(table)
    );
    const fks = builtIndexes.filter(
      (index) => is(index, ForeignKey)
    ) as unknown as ForeignKey[];

    if (!this.relational) {
      this.generateForeignKeys(fks);
    }

    if (extraConfig && builtIndexes.length > fks.length) {
      const indexes = extraConfig(table);

      dbml.newLine().tab().insert('indexes {').newLine();

      for (const indexName in indexes) {
        const index = indexes[indexName].build(table);
        dbml.tab(2);

        if (is(index, Index)) {
          const idxColumns = wrapColumns(index.config.columns);
          const idxProperties = index.config.name
            ? ` [name: '${index.config.name}'${index.config.unique ? ', unique' : ''}]`
            : '';
          dbml.insert(`${idxColumns}${idxProperties}`);
        }

        if (is(index, PrimaryKey)) {
          const pkColumns = wrapColumns(index.columns);
          dbml.insert(`${pkColumns} [pk]`);
        }

        if (is(index, UniqueConstraint)) {
          const uqColumns = wrapColumns(index.columns);
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
          (relations_[i].table as unknown as Table)[TableName],
          relation.referencedTableName
        ].sort();
        const key = `${tableNames[0]}-${tableNames[1]}${
          relation.relationName ? `-${relation.relationName}` : ''
        }`;

        if ((is(relation, One) && relation.config?.references.length) || 0 > 0) {
          left[key] = {
            type: 'one',
            sourceTable: (relation.sourceTable as unknown as Table)[TableName],
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
        .insert(wrapColumnNames(sourceColumns))
        .insert(` ${relationType === 'one' ? '-' : '>'} `)
        .escapeSpaces(foreignTable)
        .insert('.')
        .insert(wrapColumnNames(foreignColumns))
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
      } else if (isTable(value)) {
        generatedTables.push(this.generateTable(value as unknown as Table));
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
