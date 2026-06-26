CREATE TABLE `briefing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`course_code` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`frozen_context` text NOT NULL,
	`context_hash` text NOT NULL,
	`cache_key` text NOT NULL,
	`output` text,
	`error_code` text,
	`error_message` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`expires_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `insights` (
	`id` text PRIMARY KEY NOT NULL,
	`course_code` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`priority` integer,
	`category` text,
	`sources` text,
	`context_hash` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompt_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`output` text NOT NULL,
	`sources` text,
	`model_used` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
