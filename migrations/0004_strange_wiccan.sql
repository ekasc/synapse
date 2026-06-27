CREATE TABLE `academic_digest` (
	`id` text PRIMARY KEY NOT NULL,
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
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`semester_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`instructor` text,
	`credits` integer,
	`tag` text,
	`color` text,
	`signals` text
);
--> statement-breakpoint
CREATE TABLE `graph_state` (
	`id` text PRIMARY KEY NOT NULL,
	`positions` text NOT NULL,
	`viewport` text,
	`edges` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `semesters` (
	`id` text PRIMARY KEY NOT NULL,
	`term` text NOT NULL,
	`year` integer NOT NULL,
	`order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `syllabus_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`file_name` text NOT NULL,
	`raw_text` text NOT NULL,
	`extracted_data` text NOT NULL,
	`status` text DEFAULT 'mocked' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
