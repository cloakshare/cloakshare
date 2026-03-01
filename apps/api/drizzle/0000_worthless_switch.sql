CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`org_id` text,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_api_keys_key_hash` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `idx_api_keys_user_id` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text DEFAULT 'user' NOT NULL,
	`actor_label` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`resource_label` text,
	`metadata` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_audit_log_org_id` ON `audit_log` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_org_created` ON `audit_log` (`org_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_action` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_actor_id` ON `audit_log` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_resource` ON `audit_log` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `custom_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`org_id` text,
	`domain` text NOT NULL,
	`verified` integer DEFAULT false,
	`verified_at` text,
	`cname_target` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_domains_domain_unique` ON `custom_domains` (`domain`);--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`org_id` text,
	`original_filename` text,
	`file_type` text NOT NULL,
	`original_mime_type` text,
	`file_size` integer,
	`page_count` integer,
	`video_duration` integer,
	`video_width` integer,
	`video_height` integer,
	`video_qualities` text,
	`r2_prefix` text NOT NULL,
	`expires_at` text,
	`max_views` integer,
	`require_email` integer DEFAULT true,
	`allowed_domains` text,
	`password_hash` text,
	`block_download` integer DEFAULT true,
	`watermark_enabled` integer DEFAULT true,
	`watermark_template` text DEFAULT '{{email}} · {{date}} · {{session_id}}',
	`notify_url` text,
	`notify_email` text,
	`custom_domain_id` text,
	`brand_logo` text,
	`brand_color` text,
	`brand_name` text,
	`status` text DEFAULT 'processing' NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_links_user_id` ON `links` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_links_status` ON `links` (`status`);--> statement-breakpoint
CREATE INDEX `idx_links_created_at` ON `links` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_links_user_status_created` ON `links` (`user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `org_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`invited_by` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_org_invites_token_hash` ON `org_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_org_invites_org_id` ON `org_invites` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_org_invites_email` ON `org_invites` (`email`);--> statement-breakpoint
CREATE TABLE `org_members` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_org_members_org_user` ON `org_members` (`org_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_org_members_user_id` ON `org_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `rendering_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`source_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`error` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rendering_jobs_status` ON `rendering_jobs` (`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `idx_sessions_token` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`org_id` text,
	`type` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`stripe_reported` integer DEFAULT false,
	`period_start` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_usage_records_user_period` ON `usage_records` (`user_id`,`period_start`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`default_org_id` text,
	`email_verified` integer DEFAULT false,
	`email_verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `viewer_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`viewer_email` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `viewer_sessions_token_unique` ON `viewer_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `idx_viewer_sessions_token` ON `viewer_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `idx_viewer_sessions_link` ON `viewer_sessions` (`link_id`);--> statement-breakpoint
CREATE TABLE `views` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`viewer_email` text,
	`viewer_ip` text,
	`viewer_user_agent` text,
	`viewer_country` text,
	`viewer_city` text,
	`viewer_device` text,
	`viewer_browser` text,
	`viewer_os` text,
	`duration` integer,
	`pages_viewed` integer,
	`page_details` text,
	`completion_rate` real,
	`video_watch_time` integer,
	`video_max_reached` real,
	`session_token` text,
	`return_visit` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`ended_at` text,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_views_link_id` ON `views` (`link_id`);--> statement-breakpoint
CREATE INDEX `idx_views_created_at` ON `views` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_views_viewer_email` ON `views` (`viewer_email`);--> statement-breakpoint
CREATE INDEX `idx_views_session` ON `views` (`session_token`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_id` text NOT NULL,
	`event` text NOT NULL,
	`payload` text NOT NULL,
	`status_code` integer,
	`response_body` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`next_retry_at` text,
	`delivered_at` text,
	`failed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`endpoint_id`) REFERENCES `webhook_endpoints`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_next_retry` ON `webhook_deliveries` (`next_retry_at`);--> statement-breakpoint
CREATE TABLE `webhook_endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`org_id` text,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`events` text NOT NULL,
	`active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
