CREATE TABLE `learning_predictions` (
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
--> statement-breakpoint
CREATE INDEX `learning_predictions_member_idx` ON `learning_predictions` (`member_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `learning_predictions_trial_idx` ON `learning_predictions` (`trial_ip_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `learning_predictions_bucket_idx` ON `learning_predictions` (`feature_bucket`,`feedback_at`);--> statement-breakpoint
CREATE INDEX `learning_predictions_created_at_idx` ON `learning_predictions` (`created_at`);