CREATE TABLE `colors` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`color_name` text NOT NULL,
	`color_code` text NOT NULL,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`product_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`color_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`rate` text NOT NULL,
	`subtotal` text NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`total_amount` text NOT NULL,
	`amount_paid` text DEFAULT '0' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`due_date` integer,
	`is_manual_balance` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`packing_size` text NOT NULL,
	`rate` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
