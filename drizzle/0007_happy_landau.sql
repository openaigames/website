CREATE TABLE `analytics_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`visit` text NOT NULL,
	`flow` text NOT NULL,
	`parent` text DEFAULT '' NOT NULL,
	`attempt` text NOT NULL,
	`family` text NOT NULL,
	`step` text NOT NULL,
	`game_key` text DEFAULT '' NOT NULL,
	`game_title` text DEFAULT '' NOT NULL,
	`device` text NOT NULL,
	`host` text NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_analytics_step_attempt` ON `analytics_steps` (`flow`,`attempt`,`step`);--> statement-breakpoint
CREATE INDEX `idx_analytics_steps_time` ON `analytics_steps` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analytics_steps_visit` ON `analytics_steps` (`visit`);--> statement-breakpoint
ALTER TABLE `admin_oauth_states` ADD `analytics_flow` text DEFAULT '' NOT NULL;