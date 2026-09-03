-- Preview D1 Initial Schema Migration
-- Run this SQL in the Cloudflare D1 dashboard or via wrangler d1 execute
-- This creates a fresh preview database independent from production.

-- Members table (formal version - kept for schema compatibility but not used in trial mode)
CREATE TABLE IF NOT EXISTS `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`label` text DEFAULT '未命名會員' NOT NULL,
	`expires_at` text NOT NULL,
	`daily_limit` integer DEFAULT 10 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_login_at` text,
	`live_analysis_enabled` integer DEFAULT false NOT NULL,
	`last_login_device` text,
	`last_seen_at` text,
	`learning_enabled` integer DEFAULT false NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `members_username_unique` ON `members` (`username`);
CREATE INDEX IF NOT EXISTS `members_status_idx` ON `members` (`status`);
CREATE INDEX IF NOT EXISTS `members_expires_at_idx` ON `members` (`expires_at`);

-- Analysis usage tracking (formal version)
CREATE TABLE IF NOT EXISTS `analysis_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`usage_date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `analysis_usage_member_date_unique` ON `analysis_usage` (`member_id`,`usage_date`);
CREATE INDEX IF NOT EXISTS `analysis_usage_date_idx` ON `analysis_usage` (`usage_date`);

-- Trial usage tracking (trial mode - the main table for preview)
CREATE TABLE IF NOT EXISTS `trial_usage` (
	`ip_hash` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`first_used_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ip_address` text DEFAULT '未記錄' NOT NULL,
	`device` text DEFAULT '未知裝置' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
CREATE INDEX IF NOT EXISTS `trial_usage_status_idx` ON `trial_usage` (`status`);
CREATE INDEX IF NOT EXISTS `trial_usage_updated_at_idx` ON `trial_usage` (`updated_at`);

-- Learning predictions (for model calibration)
CREATE TABLE IF NOT EXISTS `learning_predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` integer,
	`trial_ip_hash` text,
	`model_version` text NOT NULL,
	`capture_mode` text NOT NULL,
	`predicted_side` text NOT NULL,
	`banker_tenths` integer NOT NULL,
	`signal_class` text NOT NULL,
	`strength_class` text NOT NULL,
	`feature_bucket` text NOT NULL,
	`snapshot_hash` text NOT NULL,
	`actual_outcome` text,
	`is_correct` integer,
	`feedback_source` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`feedback_at` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trial_ip_hash`) REFERENCES `trial_usage`(`ip_hash`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `learning_predictions_member_idx` ON `learning_predictions` (`member_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `learning_predictions_trial_idx` ON `learning_predictions` (`trial_ip_hash`,`created_at`);
CREATE INDEX IF NOT EXISTS `learning_predictions_bucket_idx` ON `learning_predictions` (`feature_bucket`,`feedback_at`);
CREATE INDEX IF NOT EXISTS `learning_predictions_created_at_idx` ON `learning_predictions` (`created_at`);
