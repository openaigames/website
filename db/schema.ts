import { sqliteTable, integer, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const messages = sqliteTable('board_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requestId: text('request_id').notNull(),
  kind: text('kind', { enum: ['wish', 'message'] }).notNull(),
  nickname: text('nickname').notNull(),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('idx_board_request_id').on(t.requestId)]);
export const limits = sqliteTable('board_limits', {
  key: text('key').primaryKey(),
  nextAt: integer('next_at').notNull(),
}, t => [index('idx_board_limits_next_at').on(t.nextAt)]);
