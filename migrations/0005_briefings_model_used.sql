ALTER TABLE `briefings` ADD `model_used` text DEFAULT 'deepseek/deepseek-v4-flash' NOT NULL;--> statement-breakpoint
ALTER TABLE `briefings` ADD `schema_version` integer DEFAULT 1 NOT NULL;
