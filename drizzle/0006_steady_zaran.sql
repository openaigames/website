CREATE TABLE `analytics_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`host` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`active_ms` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_visit_time` ON `analytics_visits` (`created_at`);