CREATE TABLE `focus_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`allowed_sites` text NOT NULL,
	`blocked_sites` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text,
	`intention` text NOT NULL,
	`planned_seconds` integer NOT NULL,
	`completed_seconds` integer NOT NULL,
	`distraction_count` integer NOT NULL,
	`focus_score` integer NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL
);
