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

export const submissions = sqliteTable('game_submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requestId: text('request_id').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description').notNull(),
  submitter: text('submitter').notNull(),
  relation: text('relation', { enum: ['creator','recommend'] }).notNull(),
  status: text('status', { enum: ['pending','archived'] }).notNull().default('pending'),
  createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('idx_submission_request').on(t.requestId), uniqueIndex('idx_submission_url').on(t.url), index('idx_submission_status_id').on(t.status,t.id)]);
export const submissionLimits = sqliteTable('submission_limits', {
  key: text('key').primaryKey(),
  nextAt: integer('next_at').notNull(),
}, t => [index('idx_submission_limits_next_at').on(t.nextAt)]);
