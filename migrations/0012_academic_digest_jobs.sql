CREATE TABLE `academic_digest_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `academic_digest_jobs_created_at_idx` ON `academic_digest_jobs` (`created_at`);
