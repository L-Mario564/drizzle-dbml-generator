import { describe, expect, it } from 'vitest';
import { compareContents } from '../utils';
import { mysqlGenerate } from '~/generators';
//import { relations } from 'drizzle-orm';
import {
  bigint,
  binary,
  boolean,
  char,
  datetime,
  decimal,
  double,
  float,
  foreignKey,
  index,
  int,
  mediumint,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  time,
  timestamp,
  tinyint,
  unique,
  uniqueIndex,
  varbinary,
  varchar,
  year
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

const pathPrefix = './src/__tests__/mysql/';

async function typesTest() {
  const myTable = mysqlTable('my_table', {
    int: int('int'),
    tinyint: tinyint('tinyint'),
    smallint: smallint('smallint'),
    mediumint: mediumint('mediumint'),
    bigint: bigint('bigint', { mode: 'bigint' }),
    real: real('real'),
    decimal: decimal('decimal'),
    double: double('double'),
    float: float('float'),
    serial: serial('serial'),
    binary: binary('binary'),
    varbinary: varbinary('varbinary', { length: 2 }),
    char: char('char'),
    varchar: varchar('varchar', { length: 128 }),
    text: text('text'),
    boolean: boolean('boolean'),
    datetime: datetime('datetime'),
    time: time('time'),
    year: year('year'),
    timestamp: timestamp('timestamp'),
    enum: mysqlEnum('enum', ['one', 'two', 'three'])
  });

  const schema = { myTable };
  const out = `${pathPrefix}types.generated.dbml`;
  mysqlGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function constraintsTest() {
  const myTable = mysqlTable('my_table', {
    pk: int('pk').primaryKey(),
    nn: int('nn').notNull(),
    u: int('u').unique(),
    defaultS: text('default_s').default('some text'),
    defaultN: int('default_n').default(1),
    defaultNow: timestamp('default_now').defaultNow(),
    ai: serial('ai'),
    multiple: text('multiple').notNull().default('other text')
  });

  const schema = { myTable };
  const out = `${pathPrefix}constraints.generated.dbml`;
  mysqlGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function inlineFkTest() {
  const users = mysqlTable('users', {
    id: serial('id').primaryKey()
  });
  const posts = mysqlTable('posts', {
    id: serial('id').primaryKey(),
    postedById: int('posted_by_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'no action'
      })
  });

  const schema = { users, posts };
  const out = `${pathPrefix}inline-fk.generated.dbml`;
  mysqlGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function fkTest() {
  const users = mysqlTable('users', {
    id: serial('id').primaryKey(),
    registeredAt: timestamp('registered_at'),
    username: text('username')
  });
  const posts = mysqlTable(
    'posts',
    {
      id: serial('id').primaryKey(),
      postedByUserRegisteredAt: timestamp('posted_by_user_registered_at'),
      postedBy: text('posted_by')
    },
    (tbl) => ({
      fk: foreignKey({
        columns: [tbl.postedBy, tbl.postedByUserRegisteredAt],
        foreignColumns: [users.username, users.registeredAt]
      })
    })
  );

  const schema = { users, posts };
  const out = `${pathPrefix}fk.generated.dbml`;
  mysqlGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function indexesTest() {
  const table = mysqlTable(
    'table',
    {
      f1: int('f1'),
      f2: int('f2'),
      f3: int('f3'),
      f4: int('f4')
    },
    (tbl) => ({
      compositePk: primaryKey(tbl.f1, tbl.f2),
      unique1: unique('key_1').on(tbl.f1),
      unique2: unique('key_2').on(tbl.f1, tbl.f2),
      unique3: uniqueIndex('key_3').on(tbl.f2),
      index1: index('key_4').on(tbl.f3),
      index2: index('key_5').on(tbl.f3, tbl.f4)
    })
  );

  const schema = { table };
  const out = `${pathPrefix}indexes.generated.dbml`;
  mysqlGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function rqbTest() {
  const users = mysqlTable('users', {
    id: serial('id').primaryKey(),
    configId: int('config_id').references(() => userConfig.id, {
      onDelete: 'set null'
    })
  });
  const usersRelations = relations(users, ({ one, many }) => ({
    userConfig: one(userConfig, {
      fields: [users.configId],
      references: [userConfig.id]
    }),
    sells: many(items)
  }));

  const userConfig = mysqlTable('user_config', {
    id: serial('id').primaryKey()
  });
  const userConfigRelations = relations(userConfig, ({ one }) => ({
    user: one(users)
  }));

  const items = mysqlTable('items', {
    id: serial('id').primaryKey(),
    soldById: int('sold_by_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade'
      })
  });
  const itemsRelations = relations(items, ({ one }) => ({
    soldBy: one(users, {
      fields: [items.soldById],
      references: [users.id]
    })
  }));

  const schema = {
    users,
    usersRelations,
    userConfig,
    userConfigRelations,
    items,
    itemsRelations
  };
  const out = `${pathPrefix}relations.generated.dbml`;
  const relational = true;
  mysqlGenerate({ schema, out, relational });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function realTest() {
  const users = mysqlTable('users', {
    id: serial('id').primaryKey(),
    registeredAt: timestamp('registered_at').notNull().defaultNow(),
    username: varchar('username', { length: 16 }).notNull().unique('uq_users_username'),
    bio: text('bio'),
    hasBlue: boolean('has_blue').notNull().default(false)
  });

  const usersRelations = relations(users, ({ many }) => ({
    followers: many(followers, { relationName: 'user_followers' }),
    following: many(followers, { relationName: 'user_follows' }),
    tweets: many(tweets),
    likes: many(likes)
  }));

  const followers = mysqlTable(
    'followers',
    {
      userId: int('user_id')
        .notNull()
        .references(() => users.id),
      followsUserId: int('follows_user_id')
        .notNull()
        .references(() => users.id)
    },
    (followers) => ({
      pk: primaryKey(followers.userId, followers.followsUserId)
    })
  );

  const followersRelations = relations(followers, ({ one }) => ({
    user: one(users, {
      fields: [followers.userId],
      references: [users.id],
      relationName: 'user_followers'
    }),
    followsUser: one(users, {
      fields: [followers.followsUserId],
      references: [users.id],
      relationName: 'user_follows'
    })
  }));

  const tweets = mysqlTable('tweets', {
    id: serial('id').primaryKey(),
    postedAt: timestamp('posted_at').notNull().defaultNow(),
    content: text('content').notNull(),
    postedById: int('posted_by_id')
      .notNull()
      .references(() => users.id)
  });

  const tweetsRelations = relations(tweets, ({ one }) => ({
    postedBy: one(users, {
      fields: [tweets.postedById],
      references: [users.id]
    })
  }));

  const likes = mysqlTable(
    'likes',
    {
      likedTweetId: int('liked_tweet_id')
        .notNull()
        .references(() => tweets.id),
      likedById: int('liked_by_id')
        .notNull()
        .references(() => users.id)
    },
    (likes) => ({
      pk: primaryKey(likes.likedById, likes.likedTweetId)
    })
  );

  const likesRelations = relations(likes, ({ one }) => ({
    likedTweet: one(tweets, {
      fields: [likes.likedTweetId],
      references: [tweets.id]
    }),
    likedBy: one(users, {
      fields: [likes.likedById],
      references: [users.id]
    })
  }));

  const schema = {
    users,
    usersRelations,
    followers,
    followersRelations,
    tweets,
    tweetsRelations,
    likes,
    likesRelations
  };
  const out = `${pathPrefix}real.generated.dbml`;
  mysqlGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

describe('MySQL dialect tests', () => {
  it('Outputs all native types', typesTest);
  it('Outputs all column constraints', constraintsTest);
  it('Outputs an inline foreign key', inlineFkTest);
  it('Outputs a foreign key', fkTest);
  it('Outputs all indexes', indexesTest);
  it('Outputs relations written with the RQB API', rqbTest);
  it('Outputs the result of a more "realistic" schema', realTest);
});
