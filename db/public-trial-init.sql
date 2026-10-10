-- MT1399 public 20-round trial schema
-- Safe to run repeatedly against the Preview or Production D1 database.

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
