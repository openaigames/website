CREATE TABLE `submission_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`next_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_submission_limits_next_at` ON `submission_limits` (`next_at`);--> statement-breakpoint
CREATE TABLE `game_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`description` text NOT NULL,
	`submitter` text NOT NULL,
	`relation` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submission_request` ON `game_submissions` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submission_url` ON `game_submissions` (`url`);--> statement-breakpoint
CREATE INDEX `idx_submission_status_id` ON `game_submissions` (`status`,`id`);