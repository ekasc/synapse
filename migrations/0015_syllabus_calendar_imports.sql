ALTER TABLE `calendar_events` ADD COLUMN `origin` text NOT NULL DEFAULT 'manual';
--> statement-breakpoint
ALTER TABLE `calendar_events` ADD COLUMN `source_key` text;
--> statement-breakpoint
ALTER TABLE `calendar_events` ADD COLUMN `source_import_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_events_syllabus_source_key_uq`
ON `calendar_events` (`course_id`, `source_key`)
WHERE `origin` = 'syllabus' AND `course_id` IS NOT NULL AND `source_key` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `syllabus_calendar_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`syllabus_import_id` text,
	`idempotency_key` text NOT NULL,
	`source_hash` text NOT NULL,
	`status` text NOT NULL DEFAULT 'completed',
	`result_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	UNIQUE (`course_id`, `idempotency_key`)
);
--> statement-breakpoint
CREATE INDEX `syllabus_calendar_imports_course_idx`
ON `syllabus_calendar_imports` (`course_id`, `created_at`);
