CREATE TABLE `game_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text NOT NULL,
	`game_key` text NOT NULL,
	`github_id` integer NOT NULL,
	`login` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_comment_request` ON `game_comments` (`github_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `idx_comment_game` ON `game_comments` (`game_key`,`id`);--> statement-breakpoint
CREATE INDEX `idx_comment_user_time` ON `game_comments` (`github_id`,`created_at`);