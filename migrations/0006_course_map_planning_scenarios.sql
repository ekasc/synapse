CREATE TABLE `planning_scenario_moves` (
	`scenario_id` text NOT NULL,
	`move_order` integer NOT NULL,
	`course_id` text NOT NULL,
	`target_semester_id` text NOT NULL,
	PRIMARY KEY(`scenario_id`, `move_order`),
	FOREIGN KEY (`scenario_id`) REFERENCES `planning_scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `planning_scenario_moves_order_idx` ON `planning_scenario_moves` (`scenario_id`,`move_order`);--> statement-breakpoint
CREATE TABLE `planning_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "planning_scenarios_revision_check" CHECK("planning_scenarios"."revision" >= 1)
);
