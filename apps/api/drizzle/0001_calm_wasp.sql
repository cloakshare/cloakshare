CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`org_id` text,
	`type` text NOT NULL,
	`link_id` text,
	`link_name` text,
	`message` text NOT NULL,
	`metadata` text,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_id` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read` ON `notifications` (`user_id`,`read`);--> statement-breakpoint
CREATE INDEX `idx_notifications_created_at` ON `notifications` (`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `spending_cap` integer;--> statement-breakpoint
CREATE INDEX `idx_links_org_id` ON `links` (`org_id`);