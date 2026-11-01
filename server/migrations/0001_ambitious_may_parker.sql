CREATE TABLE `growth_app_links` (
	`company_id` text NOT NULL,
	`app_id` text NOT NULL,
	`confirmed_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `growth_companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_app_identity` ON `growth_app_links` (`company_id`,`app_id`);--> statement-breakpoint
CREATE TABLE `growth_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`batch` text DEFAULT '' NOT NULL,
	`watch` integer DEFAULT 0 NOT NULL,
	`ignored` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`first_seen` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `growth_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`company_id` text NOT NULL,
	`url` text NOT NULL,
	`payload` text NOT NULL,
	`fingerprint` text NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	`last_checked` text NOT NULL,
	`check_error` text,
	`in_latest_list` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `growth_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_source_url` ON `growth_leads` (`source`,`url`);--> statement-breakpoint
CREATE INDEX `growth_lead_company` ON `growth_leads` (`company_id`);--> statement-breakpoint
CREATE TABLE `growth_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`url` text NOT NULL,
	`observed_at` text NOT NULL,
	`version_id` integer,
	`error` text,
	FOREIGN KEY (`run_id`) REFERENCES `growth_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `growth_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `growth_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`total` integer DEFAULT 0 NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`success` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `growth_source_state` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_checked` text,
	`last_success` text,
	`error` text,
	`baseline_ids` text
);
--> statement-breakpoint
CREATE TABLE `growth_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` text NOT NULL,
	`observed_at` text NOT NULL,
	`event` text NOT NULL,
	`payload` text NOT NULL,
	`fingerprint` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `growth_leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `growth_version_lead` ON `growth_versions` (`lead_id`,`id`);