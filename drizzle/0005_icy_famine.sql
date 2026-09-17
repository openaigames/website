CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`kind` text NOT NULL,
	`game_key` text DEFAULT '' NOT NULL,
	`game_title` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`device` text NOT NULL,
	`host` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_time` ON `analytics_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analytics_visitor_time` ON `analytics_events` (`visitor`,`created_at`);--> statement-breakpoint
CREATE TABLE `analytics_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_limit_expiry` ON `analytics_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `analytics_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
