CREATE TABLE `briefing_evidence` (
	`job_id` text NOT NULL,
	`source_id` text NOT NULL,
	`category` text NOT NULL,
	`canonical_url` text NOT NULL,
	`domain` text NOT NULL,
	`publisher` text NOT NULL,
	`published_at` text,
	`updated_at` text,
	`retrieved_at` text NOT NULL,
	`currentness` text NOT NULL,
	`retrieval_status` text NOT NULL,
	`content_fingerprint` text NOT NULL,
	`claims_supported_json` text NOT NULL,
	PRIMARY KEY(`job_id`, `source_id`)
);
--> statement-breakpoint
CREATE TABLE `briefing_evidence_cache` (
	`cache_key` text NOT NULL,
	`category` text NOT NULL,
	`evidence_json` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	PRIMARY KEY(`cache_key`, `category`)
);
--> statement-breakpoint
CREATE INDEX `briefing_evidence_cache_expires_at_idx` ON `briefing_evidence_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `briefing_request_attempts` (
	`job_id` text NOT NULL,
	`stage` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`response_id` text,
	`requested_model` text NOT NULL,
	`actual_model` text,
	`provider` text,
	`query` text,
	`response_json` text,
	`usage_json` text NOT NULL,
	`cost_microdollars` integer DEFAULT 0 NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`http_status` integer NOT NULL,
	`was_retry` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`job_id`, `stage`, `attempt_number`)
);
--> statement-breakpoint
ALTER TABLE `briefing_jobs` ADD `stage_updated_at` text;--> statement-breakpoint
ALTER TABLE `briefing_jobs` ADD `identity_candidates` text;--> statement-breakpoint
ALTER TABLE `briefing_jobs` ADD `cache_hit` integer DEFAULT 0 NOT NULL;