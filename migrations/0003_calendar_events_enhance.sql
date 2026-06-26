ALTER TABLE `calendar_events` ADD `grade_weight` integer;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `status` text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `notes` text;