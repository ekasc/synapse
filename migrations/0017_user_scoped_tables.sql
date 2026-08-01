-- Add ownership to tables created before authentication was introduced.
-- Existing single-user data is claimed only when exactly one active user exists;
-- otherwise it remains unowned rather than being exposed to the wrong account.
ALTER TABLE `insights` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `semesters` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `courses` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `planning_scenarios` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `planning_scenario_moves` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `syllabus_imports` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `academic_digest_jobs` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `calendar_events` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `practice_material_indexes` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `practice_material_chunks` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `practice_sessions` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `study_sessions` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `syllabus_calendar_imports` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `weekly_push_subscriptions` ADD COLUMN `user_id` text NOT NULL DEFAULT '';
--> statement-breakpoint

UPDATE `insights` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `semesters` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `courses` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `planning_scenarios` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `planning_scenario_moves` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `syllabus_imports` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `academic_digest_jobs` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `calendar_events` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `practice_material_indexes` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `practice_material_chunks` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `practice_sessions` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `study_sessions` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `syllabus_calendar_imports` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint
UPDATE `weekly_push_subscriptions` SET `user_id` = (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) WHERE `user_id` = '' AND (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1;
--> statement-breakpoint

-- These tables use a fixed logical id, so rebuild them with per-user composite keys.
CREATE TABLE `graph_state_user_scoped` (
	`id` text NOT NULL,
	`user_id` text NOT NULL DEFAULT '',
	`positions` text NOT NULL,
	`viewport` text,
	`edges` text NOT NULL,
	PRIMARY KEY (`id`, `user_id`)
);
--> statement-breakpoint
INSERT INTO `graph_state_user_scoped` (`id`, `user_id`, `positions`, `viewport`, `edges`)
SELECT `id`, CASE WHEN (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1 THEN (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) ELSE '' END, `positions`, `viewport`, `edges` FROM `graph_state`;
--> statement-breakpoint
DROP TABLE `graph_state`;
--> statement-breakpoint
ALTER TABLE `graph_state_user_scoped` RENAME TO `graph_state`;
--> statement-breakpoint

CREATE TABLE `academic_digest_user_scoped` (
	`id` text NOT NULL,
	`user_id` text NOT NULL DEFAULT '',
	`source` text NOT NULL,
	`file_name` text,
	`summary` text NOT NULL,
	`total_gpa` text NOT NULL,
	`projected_gpa` text NOT NULL,
	`current_course_count` integer NOT NULL,
	`finished_course_count` integer NOT NULL,
	`current_credits` integer NOT NULL,
	`finished_credits` integer NOT NULL,
	`courses` text NOT NULL,
	`trend` text NOT NULL,
	`insights` text NOT NULL,
	`extraction_source` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY (`id`, `user_id`)
);
--> statement-breakpoint
INSERT INTO `academic_digest_user_scoped` (`id`, `user_id`, `source`, `file_name`, `summary`, `total_gpa`, `projected_gpa`, `current_course_count`, `finished_course_count`, `current_credits`, `finished_credits`, `courses`, `trend`, `insights`, `extraction_source`, `updated_at`)
SELECT `id`, CASE WHEN (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1 THEN (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) ELSE '' END, `source`, `file_name`, `summary`, `total_gpa`, `projected_gpa`, `current_course_count`, `finished_course_count`, `current_credits`, `finished_credits`, `courses`, `trend`, `insights`, `extraction_source`, `updated_at` FROM `academic_digest`;
--> statement-breakpoint
DROP TABLE `academic_digest`;
--> statement-breakpoint
ALTER TABLE `academic_digest_user_scoped` RENAME TO `academic_digest`;
--> statement-breakpoint

CREATE TABLE `focus_preferences_user_scoped` (
	`id` text NOT NULL,
	`user_id` text NOT NULL DEFAULT '',
	`allowed_sites` text NOT NULL,
	`blocked_sites` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY (`id`, `user_id`)
);
--> statement-breakpoint
INSERT INTO `focus_preferences_user_scoped` (`id`, `user_id`, `allowed_sites`, `blocked_sites`, `updated_at`)
SELECT `id`, CASE WHEN (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1 THEN (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) ELSE '' END, `allowed_sites`, `blocked_sites`, `updated_at` FROM `focus_preferences`;
--> statement-breakpoint
DROP TABLE `focus_preferences`;
--> statement-breakpoint
ALTER TABLE `focus_preferences_user_scoped` RENAME TO `focus_preferences`;
--> statement-breakpoint

CREATE TABLE `weekly_digest_cache_user_scoped` (
	`week_start` text NOT NULL,
	`user_id` text NOT NULL DEFAULT '',
	`digest_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY (`week_start`, `user_id`)
);
--> statement-breakpoint
INSERT INTO `weekly_digest_cache_user_scoped` (`week_start`, `user_id`, `digest_json`, `created_at`)
SELECT `week_start`, CASE WHEN (SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL) = 1 THEN (SELECT `id` FROM `users` WHERE `deleted_at` IS NULL LIMIT 1) ELSE '' END, `digest_json`, `created_at` FROM `weekly_digest_cache`;
--> statement-breakpoint
DROP TABLE `weekly_digest_cache`;
--> statement-breakpoint
ALTER TABLE `weekly_digest_cache_user_scoped` RENAME TO `weekly_digest_cache`;
