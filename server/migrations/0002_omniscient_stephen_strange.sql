CREATE TABLE `funding_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_url` text NOT NULL,
	`original_url` text NOT NULL,
	`first_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funding_document_url` ON `funding_documents` (`canonical_url`);--> statement-breakpoint
CREATE TABLE `funding_event_evidence` (
	`event_id` text NOT NULL,
	`evidence_key` text NOT NULL,
	`document_id` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `funding_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `funding_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funding_event_evidence_key` ON `funding_event_evidence` (`event_id`,`evidence_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `funding_event_document` ON `funding_event_evidence` (`event_id`,`document_id`);--> statement-breakpoint
CREATE TABLE `funding_events` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`version` integer NOT NULL,
	`payload` text NOT NULL,
	`fingerprint` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`duplicate_of` text,
	`archive_reason` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `growth_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `funding_company` ON `funding_events` (`company_id`);--> statement-breakpoint
CREATE TABLE `funding_idempotency` (
	`key` text PRIMARY KEY NOT NULL,
	`request_hash` text NOT NULL,
	`response` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `funding_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`evidence_key` text NOT NULL,
	`document_id` text NOT NULL,
	`observed_at` text NOT NULL,
	`outcome` text NOT NULL,
	`note` text NOT NULL,
	`version` integer NOT NULL,
	`evidence` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `funding_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `funding_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `funding_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`reason` text NOT NULL,
	`snapshot` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `funding_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funding_revision_version` ON `funding_revisions` (`event_id`,`version`);