CREATE TABLE `weekly_push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_push_subscriptions_endpoint_unique` ON `weekly_push_subscriptions` (`endpoint`);
