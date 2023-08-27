import { describe, expect, it } from 'vitest';
import {
  bigint,
  bigserial,
  boolean,
  char,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  interval,
  json,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  smallserial,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core';
import { compareWith } from '../utils';
import { pgGenerator } from '~/generators';
import { PgSchema } from '~/types';

function typesTest() {
  const myEnum = pgEnum('my_enum', ['value_1', 'value_2', 'value_3']);
  
  const myTable = pgTable('my_table', {
    integer: integer('integer'),
    smallint: smallint('smallint'),
    bigint: bigint('bigint', { mode: 'bigint' }),
    serial: serial('serial'),
    smallserial: smallserial('smallserial'),
    bigserial: bigserial('bigserial', { mode: 'bigint' }),
    boolean: boolean('boolean'),
    text: text('text'),
    varchar: varchar('varchar'),
    char: char('char'),
    numeric: numeric('numeric'),
    real: real('real'),
    doublePrecision: doublePrecision('double_precision'),
    json: json('json'),
    jsonb: jsonb('jsonb'),
    time: time('time'),
    timestamp: timestamp('timestamp'),
    timestampP3: timestamp('timestamp_p3', { precision: 3 }),
    timestampWT: timestamp('timestamp_wt', { withTimezone: true }),
    date: date('date'),
    interval: interval('interval'),
    intervalDay: interval('interval_day', { fields: 'day' }),
    intervalP3: interval('interval_p3', { precision: 3 }),
    anEnum: myEnum('an_enum'),
    intArr: integer('int_arr').array(),
    int2dArr: integer('int_2d_arr').array(3).array()
  });
  const schema = { myEnum, myTable } as unknown as PgSchema;
  const generated = pgGenerator(schema);
  expect(compareWith(generated, './pg/types.dbml')).toBe(true);
}

function constraintsTest() {
  const myTable = pgTable('my_table', {
    pk: integer('pk').primaryKey(),
    nn: integer('nn').notNull(),
    u: integer('u').unique(),
    defaultS: text('default_s').default('some text'),
    defaultN: integer('default_n').default(1),
    defaultNow: timestamp('default_now').defaultNow(),
    defaultA: integer('default_a').array().default([1, 2, 3]),
    ai: serial('ai'),
    multiple: text('multiple').notNull().default('other text')
  });

  const schema = { myTable } as unknown as PgSchema;
  const generated = pgGenerator(schema);
  expect(compareWith(generated, './pg/constraints.dbml')).toBe(true);
}

function inlineFkTest() {
  const users = pgTable('users', {
    id: serial('id').primaryKey()
  });
  const posts = pgTable('posts', {
    id: serial('id').primaryKey(),
    postedById: integer('posted_by_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'no action'
    })
  });

  const schema = { users, posts } as unknown as PgSchema;
  const generated = pgGenerator(schema);
  expect(compareWith(generated, './pg/inline-fk.dbml')).toBe(true);
}

function fkTest() {
  const users = pgTable('users', {
    id: serial('id').primaryKey(),
    registeredAt: timestamp('registered_at'),
    username: text('username'),
  });
  const posts = pgTable('posts', {
    id: serial('id').primaryKey(),
    postedByUserRegisteredAt: timestamp('posted_by_user_registered_at'),
    postedBy: text('posted_by')
  }, (tbl) => ({
    fk: foreignKey({
      columns: [tbl.postedBy, tbl.postedByUserRegisteredAt],
      foreignColumns: [users.username, users.registeredAt]
    })
  }));

  const schema = { users, posts } as unknown as PgSchema;
  const generated = pgGenerator(schema);
  expect(compareWith(generated, './pg/fk.dbml')).toBe(true);
}

function indexesTest() {
  const table = pgTable('table', {
    f1: integer('f1'),
    f2: integer('f2'),
    f3: integer('f3'),
    f4: integer('f4')
  }, (tbl) => ({
    compositePk: primaryKey(tbl.f1, tbl.f2),
    unique1: unique('key_1').on(tbl.f1),
    unique2: unique('key_2').on(tbl.f1, tbl.f2),
    unique3: uniqueIndex('key_3').on(tbl.f2),
    index1: index('key_4').on(tbl.f3),
    index2: index('key_5').on(tbl.f3, tbl.f4),
    index3: index().on(tbl.f4)
  }));

  const schema = { table } as unknown as PgSchema;
  const generated = pgGenerator(schema);
  expect(compareWith(generated, './pg/indexes.dbml')).toBe(true);
}

describe('Postgres dialect tests', () => {
  it('Outputs all native types', typesTest);
  it('Outputs all column constraints', constraintsTest);
  it('Outputs an inline foreign key', inlineFkTest);
  it('Outputs a foreign key', fkTest);
  it('Outputs all indexes', indexesTest);
});
