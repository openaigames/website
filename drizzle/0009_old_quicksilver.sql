ALTER TABLE `submission_reviews` ADD `from_creation_method` text;--> statement-breakpoint
ALTER TABLE `submission_reviews` ADD `to_creation_method` text;--> statement-breakpoint
ALTER TABLE `submission_reviews` ADD `from_creation_note` text;--> statement-breakpoint
ALTER TABLE `submission_reviews` ADD `to_creation_note` text;--> statement-breakpoint
ALTER TABLE `game_submissions` ADD `creation_method` text DEFAULT 'undeclared' NOT NULL;--> statement-breakpoint
ALTER TABLE `game_submissions` ADD `creation_note` text DEFAULT '' NOT NULL;