ALTER TABLE `calendar_events` ADD COLUMN `course_id` text;
--> statement-breakpoint
DELETE FROM `calendar_events`;
--> statement-breakpoint
CREATE INDEX `calendar_events_course_id_idx` ON `calendar_events` (`course_id`);
