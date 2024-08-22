# Drizzle DBML Generator

Generate DBML markup from your schema defined with Drizzle ORM. Works with any dialect.

## Generate DBML

To generate the DBML markup from your schema, all you have to do is run a script that executes the generate function of the dialect you're working with. To do that, you must install `tsx` to run Typescript files, `drizzle-orm` if it's not already installed and `drizzle-dbml-generator` of course.

```bash
# npm
npm i drizzle-orm
npm i -D drizzle-dbml-generator tsx
# yarn
yarn add drizzle-orm
yarn add -D drizzle-dbml-generator tsx
# pnpm
pnpm add drizzle-orm
pnpm add -D drizzle-dbml-generator tsx
```

### Example

**schema.ts**

```ts
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  registeredAt: timestamp('registered_at').notNull().defaultNow(),
  username: varchar('username', { length: 16 }).notNull().unique('uq_users_username'),
  bio: text('bio'),
  hasBlue: boolean('has_blue').notNull().default(false)
});

export const usersRelations = relations(users, ({ many }) => ({
  followers: many(followers, { relationName: 'user_followers' }),
  following: many(followers, { relationName: 'user_follows' }),
  tweets: many(tweets),
  likes: many(likes)
}));

export const followers = pgTable(
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

export const followersRelations = relations(followers, ({ one }) => ({
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

export const tweets = pgTable('tweets', {
  id: serial('id').primaryKey(),
  postedAt: timestamp('posted_at').notNull().defaultNow(),
  content: text('content').notNull(),
  postedById: integer('posted_by_id')
    .notNull()
    .references(() => users.id)
});

export const tweetsRelations = relations(tweets, ({ one }) => ({
  postedBy: one(users, {
    fields: [tweets.postedById],
    references: [users.id]
  })
}));

export const likes = pgTable(
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

export const likesRelations = relations(likes, ({ one }) => ({
  likedTweet: one(tweets, {
    fields: [likes.likedTweetId],
    references: [tweets.id]
  }),
  likedBy: one(users, {
    fields: [likes.likedById],
    references: [users.id]
  })
}));
```

**dbml.ts**

```ts
import * as schema from './schema';
import { pgGenerate } from 'drizzle-dbml-generator'; // Using Postgres for this example

const out = './schema.dbml';
const relational = true;

pgGenerate({ schema, out, relational });
```

Running the following command will generate the file with the DBML:

```bash
# You can add this as a package.json script
tsx dbml.ts
```

**schema.dbml**

```dbml
table users {
  id serial [pk, not null, increment]
  registered_at timestamp [not null, default: `now()`]
  username varchar(16) [not null, unique]
  bio text
  has_blue boolean [not null, default: false]
}

table followers {
  user_id integer [not null]
  follows_user_id integer [not null]

  indexes {
    (user_id, follows_user_id) [pk]
  }
}

table tweets {
  id serial [pk, not null, increment]
  posted_at timestamp [not null, default: `now()`]
  content text [not null]
  posted_by_id integer [not null]
}

table likes {
  liked_tweet_id integer [not null]
  liked_by_id integer [not null]

  indexes {
    (liked_by_id, liked_tweet_id) [pk]
  }
}

ref followers_user_id_users_id_fk: followers.user_id > users.id [delete: no action, update: no action]

ref followers_follows_user_id_users_id_fk: followers.follows_user_id > users.id [delete: no action, update: no action]

ref tweets_posted_by_id_users_id_fk: tweets.posted_by_id > users.id [delete: no action, update: no action]

ref likes_liked_tweet_id_tweets_id_fk: likes.liked_tweet_id > tweets.id [delete: no action, update: no action]

ref likes_liked_by_id_users_id_fk: likes.liked_by_id > users.id [delete: no action, update: no action]
```

## Options

**pgGenerate**

| Option     | Type     | Description                                                                                                                                                                                               |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| schema     | PgSchema | An object containing Postgres dialect tables, enums and relations                                                                                                                                         |
| out?       | string   | The output directory and file name. Uses the current working directory as the root. If not set, it will not write the DBML file.                                                                          |
| relational | boolean? | If set to true, it will create references based on the relations generated with the `relations` function instead of foreign keys. Useful for databases that don't support foreign keys. Default: `false`. |

**mysqlGenerate**

| Option     | Type        | Description                                                                                                                                                                                               |
| ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| schema     | MySqlSchema | An object containing MySQL dialect tables and relations                                                                                                                                                   |
| out?       | string      | The output directory and file name. Uses the current working directory as the root. If not set, it will not write the DBML file.                                                                          |
| relational | boolean?    | If set to true, it will create references based on the relations generated with the `relations` function instead of foreign keys. Useful for databases that don't support foreign keys. Default: `false`. |

**sqliteGenerate**

| Option     | Type         | Description                                                                                                                                                                                               |
| ---------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| schema     | SQLiteSchema | An object containing SQLite dialect tables and relations                                                                                                                                                  |
| out?       | string       | The output directory and file name. Uses the current working directory as the root. If not set, it will not write the DBML file.                                                                          |
| relational | boolean?     | If set to true, it will create references based on the relations generated with the `relations` function instead of foreign keys. Useful for databases that don't support foreign keys. Default: `false`. |

All generate functions return the DBML as a string regardless if a file is written or not, in case you want to do something with the generated DBML.
