CREATE TABLE `practice_material_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text NOT NULL,
	`course_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`page_start` integer,
	`page_end` integer,
	`text` text NOT NULL,
	`normalized_text` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practice_material_chunks_material_chunk_idx` ON `practice_material_chunks` (`material_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `practice_material_chunks_course_material_idx` ON `practice_material_chunks` (`course_id`,`material_id`,`chunk_index`);--> statement-breakpoint
CREATE TABLE `practice_material_indexes` (
	`material_id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`page_count` integer,
	`next_page` integer DEFAULT 1 NOT NULL,
	`character_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`index_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "practice_material_indexes_status_check" CHECK("practice_material_indexes"."status" IN ('pending', 'indexing', 'ready', 'needs_ocr', 'unsupported', 'failed', 'too_large')),
	CONSTRAINT "practice_material_indexes_next_page_check" CHECK("practice_material_indexes"."next_page" >= 1),
	CONSTRAINT "practice_material_indexes_character_count_check" CHECK("practice_material_indexes"."character_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `practice_material_indexes_course_status_idx` ON `practice_material_indexes` (`course_id`,`status`);--> statement-breakpoint
