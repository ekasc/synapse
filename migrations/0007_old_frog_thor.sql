ALTER TABLE `briefing_jobs` ADD `active_key` text;--> statement-breakpoint
ALTER TABLE `briefing_jobs` ADD `lease_token` text;--> statement-breakpoint
ALTER TABLE `briefing_jobs` ADD `client_ip_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `briefing_jobs_active_key_unique` ON `briefing_jobs` (`active_key`) WHERE "briefing_jobs"."active_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `briefing_jobs_created_at_idx` ON `briefing_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `briefing_jobs_ip_created_at_idx` ON `briefing_jobs` (`client_ip_hash`,`created_at`);--> statement-breakpoint
ALTER TABLE `briefings` ADD `briefing_json` text;