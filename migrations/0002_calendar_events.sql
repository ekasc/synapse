CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`course_code` text NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'assignment' NOT NULL,
	`date` integer NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`time` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
