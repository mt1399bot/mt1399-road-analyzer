ALTER TABLE `trial_usage` ADD `ip_address` text DEFAULT '未記錄' NOT NULL;--> statement-breakpoint
ALTER TABLE `trial_usage` ADD `device` text DEFAULT '未知裝置' NOT NULL;--> statement-breakpoint
ALTER TABLE `trial_usage` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX `trial_usage_status_idx` ON `trial_usage` (`status`);--> statement-breakpoint
CREATE INDEX `trial_usage_updated_at_idx` ON `trial_usage` (`updated_at`);