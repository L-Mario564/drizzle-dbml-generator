import { describe, expect, it } from 'vitest';
import { compareContents } from '../utils';
import { sqliteGenerate } from '~/generators';
import { relations, sql } from 'drizzle-orm';
import {
  blob,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

const pathPrefix = './src/__tests__/sqlite/';

async function typesTest() {
  const myTable = sqliteTable('my_table', {
    integer: integer('integer'),
    real: real('real'),
    text: text('text'),
    blob: blob('blob')
  });

  const schema = { myTable };
  const out = `${pathPrefix}types.generated.dbml`;
  sqliteGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function constraintsTest() {
  const myTable = sqliteTable('my_table', {
    pk: integer('pk').primaryKey({
      autoIncrement: true
    }),
    nn: integer('nn').notNull(),
    u: integer('u').unique(),
    defaultS: text('default_s').default('some text'),
    defaultN: integer('default_n').default(1),
    multiple: text('multiple').notNull().default('other text')
  });

  const schema = { myTable };
  const out = `${pathPrefix}constraints.generated.dbml`;
  sqliteGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function inlineFkTest() {
  const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true })
  });
  const posts = sqliteTable('posts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    postedById: integer('posted_by_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'no action'
      })
  });

  const schema = { users, posts };
  const out = `${pathPrefix}inline-fk.generated.dbml`;
  sqliteGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function fkTest() {
  const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    registeredAt: text('registered_at'),
    username: text('username')
  });
  const posts = sqliteTable(
    'posts',
    {
      id: integer('id').primaryKey({ autoIncrement: true }),
      postedByUserRegisteredAt: text('posted_by_user_registered_at'),
      postedBy: text('posted_by')
    },
    (tbl) => ({
      fk: foreignKey(() => ({
        columns: [tbl.postedBy, tbl.postedByUserRegisteredAt],
        foreignColumns: [users.username, users.registeredAt]
      }))
    })
  );

  const schema = { users, posts };
  const out = `${pathPrefix}fk.generated.dbml`;
  sqliteGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function indexesTest() {
  const table = sqliteTable(
    'table',
    {
      f1: integer('f1'),
      f2: integer('f2'),
      f3: integer('f3'),
      f4: integer('f4')
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
  sqliteGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function rqbTest() {
  const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    configId: integer('config_id').references(() => userConfig.id, {
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

  const userConfig = sqliteTable('user_config', {
    id: integer('id').primaryKey({ autoIncrement: true })
  });
  const userConfigRelations = relations(userConfig, ({ one }) => ({
    user: one(users)
  }));

  const items = sqliteTable('items', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    soldById: integer('sold_by_id')
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
  sqliteGenerate({ schema, out, relational });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

async function realTest() {
  const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    registeredAt: text('registered_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    username: text('username').notNull().unique('uq_users_username'),
    bio: text('bio'),
    hasBlue: integer('has_blue', { mode: 'boolean' }).notNull().default(false)
  });

  const usersRelations = relations(users, ({ many }) => ({
    followers: many(followers, { relationName: 'user_followers' }),
    following: many(followers, { relationName: 'user_follows' }),
    tweets: many(tweets),
    likes: many(likes)
  }));

  const followers = sqliteTable(
    'followers',
    {
      userId: integer('user_id')
        .notNull()
        .references(() => users.id),
      followsUserId: integer('follows_user_id')
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

  const tweets = sqliteTable('tweets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    postedAt: text('posted_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    content: text('content').notNull(),
    postedById: integer('posted_by_id')
      .notNull()
      .references(() => users.id)
  });

  const tweetsRelations = relations(tweets, ({ one }) => ({
    postedBy: one(users, {
      fields: [tweets.postedById],
      references: [users.id]
    })
  }));

  const likes = sqliteTable(
    'likes',
    {
      likedTweetId: integer('liked_tweet_id')
        .notNull()
        .references(() => tweets.id),
      likedById: integer('liked_by_id')
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
  sqliteGenerate({ schema, out });

  const result = await compareContents(out);
  expect(result).toBe(true);
}

describe('SQLite dialect tests', () => {
  it('Outputs all native types', typesTest);
  it('Outputs all column constraints', constraintsTest);
  it('Outputs an inline foreign key', inlineFkTest);
  it('Outputs a foreign key', fkTest);
  it('Outputs all indexes', indexesTest);
  it('Outputs relations written with the RQB API', rqbTest);
  it('Outputs the result of a more "realistic" schema', realTest);
});
