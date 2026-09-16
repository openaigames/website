CREATE TABLE `admin_oauth_states` (
	`hash` text PRIMARY KEY NOT NULL,
	`verifier` text NOT NULL,
	`return_to` text DEFAULT '/admin' NOT NULL,
	`ip_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_oauth_ip_created` ON `admin_oauth_states` (`ip_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`github_id` integer NOT NULL,
	`login` text NOT NULL,
	`token` text NOT NULL,
	`csrf` text NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_session_expiry` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `submission_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` integer NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`actor_id` integer NOT NULL,
	`actor_login` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_submission` ON `submission_reviews` (`submission_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `game_submissions` ADD `review_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `game_submissions` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `game_submissions` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `game_submissions` ADD `review_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Only records already public before moderation was introduced are carried over.
UPDATE game_submissions SET status='approved', reviewed_by='legacy-public', reviewed_at=created_at WHERE status='pending';
