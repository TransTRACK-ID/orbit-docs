CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text,
	`app_name` text,
	`action` text NOT NULL,
	`user` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `app_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`version` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `apps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner` text,
	`status` text DEFAULT 'active' NOT NULL,
	`repo_url` text,
	`created_at` integer,
	`updated_at` integer
);
