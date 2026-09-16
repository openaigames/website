CREATE TABLE `game_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_key` text NOT NULL,
	`github_id` integer NOT NULL,
	`rating` integer,
	`liked` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reaction_game_user` ON `game_reactions` (`game_key`,`github_id`);