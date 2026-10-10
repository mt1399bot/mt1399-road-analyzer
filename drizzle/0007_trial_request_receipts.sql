CREATE TABLE `trial_request_receipts` (
	`request_id` text PRIMARY KEY NOT NULL,
	`ip_hash` text NOT NULL,
	`recorded` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`ip_hash`) REFERENCES `trial_usage`(`ip_hash`) ON UPDATE no action ON DELETE cascade
);
