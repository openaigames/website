CREATE TABLE `board_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`next_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_board_limits_next_at` ON `board_limits` (`next_at`);--> statement-breakpoint
CREATE TABLE `board_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text NOT NULL,
	`kind` text NOT NULL,
	`nickname` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_board_request_id` ON `board_messages` (`request_id`);