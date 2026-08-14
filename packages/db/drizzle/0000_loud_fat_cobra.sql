CREATE TABLE `alcohol_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cocktail_families` (
	`id` text PRIMARY KEY NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `flavor_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingredient_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text NOT NULL,
	`alias` text NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ingredient_aliases_alias_idx` ON `ingredient_aliases` (`alias`);--> statement-breakpoint
CREATE TABLE `ingredient_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`parent_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `ingredient_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ingredient_categories_parent_id_idx` ON `ingredient_categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`category_id` text NOT NULL,
	`parent_ingredient_id` text,
	`alcohol_group_id` text,
	`can_be_staple` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `ingredient_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`alcohol_group_id`) REFERENCES `alcohol_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ingredients_parent_ingredient_id_idx` ON `ingredients` (`parent_ingredient_id`);--> statement-breakpoint
CREATE INDEX `ingredients_alcohol_group_id_idx` ON `ingredients` (`alcohol_group_id`);--> statement-breakpoint
CREATE INDEX `ingredients_category_id_idx` ON `ingredients` (`category_id`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_items_ingredient_id_uidx` ON `inventory_items` (`ingredient_id`);--> statement-breakpoint
CREATE TABLE `recipe_flavor_tags` (
	`recipe_id` text NOT NULL,
	`flavor_tag_id` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`flavor_tag_id`) REFERENCES `flavor_tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_flavor_tags_uidx` ON `recipe_flavor_tags` (`recipe_id`,`flavor_tag_id`);--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_version_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`amount_ml` real,
	`role` text NOT NULL,
	`either_group_id` text,
	`display_note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_version_id`) REFERENCES `recipe_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredients_recipe_version_id_idx` ON `recipe_ingredients` (`recipe_version_id`);--> statement-breakpoint
CREATE TABLE `recipe_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`version_name` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text,
	`source_revision` text,
	`glassware` text,
	`garnish` text,
	`steps_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`primary_version_id` text,
	`family_id` text NOT NULL,
	`editor_recommended` integer DEFAULT 0 NOT NULL,
	`recommendation_order` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`iba_category` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `cocktail_families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recipes_status_editor_recommended_idx` ON `recipes` (`status`,`editor_recommended`);--> statement-breakpoint
CREATE TABLE `shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_items_ingredient_id_uidx` ON `shopping_items` (`ingredient_id`);--> statement-breakpoint
CREATE TABLE `staple_settings` (
	`ingredient_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
