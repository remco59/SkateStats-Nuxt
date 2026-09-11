CREATE TABLE `blacklist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`signature` text NOT NULL,
	`competition_name` text NOT NULL,
	`competition_date` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blacklist_user_signature` ON `blacklist` (`user_id`,`signature`);--> statement-breakpoint
CREATE TABLE `competitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`venue` text,
	`date` text NOT NULL,
	`notes` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_meta` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_competition_user` ON `competitions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_competition_user_date` ON `competitions` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `import_preview_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`source` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`expires_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_import_preview_user` ON `import_preview_batches` (`user_id`);--> statement-breakpoint
CREATE TABLE `osta_profile_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`pid` text NOT NULL,
	`search_name` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`monitor_mode` text DEFAULT 'notify' NOT NULL,
	`season` text NOT NULL,
	`last_checked_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_osta_link_user_pid` ON `osta_profile_links` (`user_id`,`pid`);--> statement-breakpoint
CREATE INDEX `idx_osta_link_user` ON `osta_profile_links` (`user_id`);--> statement-breakpoint
CREATE TABLE `race_blacklist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`competition_signature` text NOT NULL,
	`race_identity_signature` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_race_blacklist_unique` ON `race_blacklist` (`user_id`,`competition_signature`,`race_identity_signature`);--> statement-breakpoint
CREATE TABLE `race_laps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`race_id` integer NOT NULL,
	`lap_index` integer NOT NULL,
	`lap_ms` integer NOT NULL,
	FOREIGN KEY (`race_id`) REFERENCES `races`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_race_lap_unique` ON `race_laps` (`race_id`,`lap_index`);--> statement-breakpoint
CREATE TABLE `races` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`distance_m` integer NOT NULL,
	`status` text DEFAULT 'finished' NOT NULL,
	`total_time_ms` integer,
	`track_type` text DEFAULT 'indoor' NOT NULL,
	`lane` text,
	`opponent` text,
	`category` text,
	`class_name` text,
	`tag` text,
	`notes` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`sequence_in_day` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_race_competition` ON `races` (`competition_id`);--> statement-breakpoint
CREATE INDEX `idx_race_user` ON `races` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_race_user_distance` ON `races` (`user_id`,`distance_m`);--> statement-breakpoint
CREATE TABLE `targets` (
	`user_id` integer NOT NULL,
	`distance_m` integer NOT NULL,
	`target_time_ms` integer,
	`generator_profile_json` text,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_target_user_distance` ON `targets` (`user_id`,`distance_m`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`skater_name` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`theme_preference` text DEFAULT 'dark' NOT NULL,
	`motion_preference` text DEFAULT 'all' NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);