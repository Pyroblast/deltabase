CREATE TABLE `apps` (
	`id` text PRIMARY KEY NOT NULL,
	`first_seen` text NOT NULL,
	`watch` integer DEFAULT 0 NOT NULL,
	`ignored` integer DEFAULT 0 NOT NULL,
	`tags` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` text NOT NULL,
	`source_id` text,
	`snapshot_id` integer,
	`market` text NOT NULL,
	`type` text NOT NULL,
	`observed_at` text NOT NULL,
	`details` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_app` ON `events` (`app_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `listings` (
	`app_id` text NOT NULL,
	`market` text NOT NULL,
	`name` text NOT NULL,
	`developer` text NOT NULL,
	`icon` text NOT NULL,
	`url` text NOT NULL,
	`category` integer NOT NULL,
	`price` integer,
	`currency` text NOT NULL,
	`release_date` text,
	`metadata` text,
	`metadata_at` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_identity` ON `listings` (`app_id`,`market`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` text NOT NULL,
	`audience` text NOT NULL,
	`hypothesis` text NOT NULL,
	`evidence` text NOT NULL,
	`next_step` text NOT NULL,
	`links` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ranks` (
	`snapshot_id` integer NOT NULL,
	`app_id` text NOT NULL,
	`rank` integer NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rank_identity` ON `ranks` (`snapshot_id`,`app_id`);--> statement-breakpoint
CREATE INDEX `rank_app` ON `ranks` (`app_id`);--> statement-breakpoint
CREATE TABLE `run_items` (
	`run_id` text NOT NULL,
	`source_id` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_item_identity` ON `run_items` (`run_id`,`source_id`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`total` integer NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`success` integer DEFAULT 0 NOT NULL,
	`empty` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`observed_at` text NOT NULL,
	`source_updated_at` text,
	`fingerprint` text NOT NULL,
	`count` integer NOT NULL,
	`raw` blob NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snapshot_identity` ON `snapshots` (`source_id`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `snapshot_history` ON `snapshots` (`source_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`market` text NOT NULL,
	`category` integer NOT NULL,
	`kind` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_checked` text,
	`last_success` text,
	`error` text,
	`count` integer DEFAULT 0 NOT NULL
);
