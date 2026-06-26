CREATE TABLE `briefings` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`institution` text NOT NULL,
	`professor` text NOT NULL,
	`rmp_rating` text NOT NULL,
	`rmp_count` integer,
	`workload` text NOT NULL,
	`weekly_hours` text,
	`prereq_readiness` text NOT NULL,
	`grade_structure` text NOT NULL,
	`recommendation` text NOT NULL,
	`sources` text NOT NULL,
	`researched_at` text NOT NULL
);
