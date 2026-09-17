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
  status: text('status', { enum: ['pending','approved','rejected','archived'] }).notNull().default('pending'),
  reviewVersion: integer('review_version').notNull().default(0),
  reviewedAt: integer('reviewed_at'),
  reviewedBy: text('reviewed_by'),
  reviewNote: text('review_note').notNull().default(''),
  createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('idx_submission_request').on(t.requestId), uniqueIndex('idx_submission_url').on(t.url), index('idx_submission_status_id').on(t.status,t.id)]);
export const submissionLimits = sqliteTable('submission_limits', {
  key: text('key').primaryKey(),
  nextAt: integer('next_at').notNull(),
}, t => [index('idx_submission_limits_next_at').on(t.nextAt)]);

export const submissionReviews = sqliteTable('submission_reviews', {
  id: text('id').primaryKey(),
  submissionId: integer('submission_id').notNull(),
  fromStatus: text('from_status').notNull(),
  toStatus: text('to_status').notNull(),
  actorId: integer('actor_id').notNull(),
  actorLogin: text('actor_login').notNull(),
  note: text('note').notNull(),
  createdAt: integer('created_at').notNull(),
}, t => [index('idx_reviews_submission').on(t.submissionId,t.createdAt)]);
export const adminOAuthStates = sqliteTable('admin_oauth_states', {
  hash: text('hash').primaryKey(),
  verifier: text('verifier').notNull(),
  returnTo: text('return_to').notNull().default('/admin'),
  ipKey: text('ip_key').notNull(),
  createdAt: integer('created_at').notNull(),
}, t => [index('idx_oauth_ip_created').on(t.ipKey,t.createdAt)]);
export const adminSessions = sqliteTable('admin_sessions', {
  hash: text('hash').primaryKey(),
  githubId: integer('github_id').notNull(),
  login: text('login').notNull(),
  token: text('token').notNull(),
  csrf: text('csrf').notNull(),
  expiresAt: integer('expires_at').notNull(),
  verifiedAt: integer('verified_at').notNull(),
}, t => [index('idx_admin_session_expiry').on(t.expiresAt)]);

export const gameComments = sqliteTable('game_comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requestId: text('request_id').notNull(),
  gameKey: text('game_key').notNull(),
  githubId: integer('github_id').notNull(),
  login: text('login').notNull(),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull(),
  deletedAt: integer('deleted_at'),
}, t => [uniqueIndex('idx_comment_request').on(t.githubId,t.requestId), index('idx_comment_game').on(t.gameKey,t.id), index('idx_comment_user_time').on(t.githubId,t.createdAt)]);

export const gameReactions = sqliteTable('game_reactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameKey: text('game_key').notNull(),
  githubId: integer('github_id').notNull(),
  rating: integer('rating'),
  liked: integer('liked').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
}, t => [uniqueIndex('idx_reaction_game_user').on(t.gameKey,t.githubId)]);

export const analyticsEvents = sqliteTable('analytics_events', {
  id: text('id').primaryKey(),
  visitor: text('visitor').notNull(),
  kind: text('kind', { enum: ['pageview','play'] }).notNull(),
  gameKey: text('game_key').notNull().default(''),
  gameTitle: text('game_title').notNull().default(''),
  source: text('source').notNull(),
  device: text('device').notNull(),
  host: text('host').notNull(),
  createdAt: integer('created_at').notNull(),
}, t => [index('idx_analytics_time').on(t.createdAt), index('idx_analytics_visitor_time').on(t.visitor,t.createdAt)]);
export const analyticsMeta = sqliteTable('analytics_meta', {
  key: text('key').primaryKey(),
  value: integer('value').notNull(),
});
export const analyticsLimits = sqliteTable('analytics_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, t => [index('idx_analytics_limit_expiry').on(t.expiresAt)]);
