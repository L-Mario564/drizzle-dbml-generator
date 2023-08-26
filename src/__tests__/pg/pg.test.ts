import { describe, expect, it } from 'vitest';
import {
  bigint,
  bigserial,
  boolean,
  char,
  date,
  doublePrecision,
  integer,
  interval,
  json,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  serial,
  smallint,
  smallserial,
  text,
  time,
  timestamp,
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
    postedById: integer('posted_by_id').notNull().references(() => users.id)
  });

  const schema = { users, posts } as unknown as PgSchema;
  const generated = pgGenerator(schema);
  expect(compareWith(generated, './pg/inline-fks.dbml')).toBe(true);
}

describe('Postgres dialect tests', () => {
  it('Outputs all native types', typesTest);
  it('Outputs all column constraints', constraintsTest);
  it('Outputs an inline foreign key', inlineFkTest);
});
