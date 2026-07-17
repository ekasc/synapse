CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`course_code` text NOT NULL,
	`source_materials` text NOT NULL,
	`questions` text NOT NULL,
	`flashcards` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`current_question_index` integer DEFAULT 0 NOT NULL,
	`missed_question_ids` text DEFAULT '[]' NOT NULL,
	`current_card_index` integer DEFAULT 0 NOT NULL,
	`card_side` text DEFAULT 'front' NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "practice_sessions_score_check" CHECK("practice_sessions"."score" >= 0),
	CONSTRAINT "practice_sessions_current_question_index_check" CHECK("practice_sessions"."current_question_index" >= 0),
	CONSTRAINT "practice_sessions_current_card_index_check" CHECK("practice_sessions"."current_card_index" >= 0),
	CONSTRAINT "practice_sessions_card_side_check" CHECK("practice_sessions"."card_side" IN ('front', 'back')),
	CONSTRAINT "practice_sessions_status_check" CHECK("practice_sessions"."status" IN ('in_progress', 'completed', 'paused'))
);
--> statement-breakpoint
CREATE INDEX `practice_sessions_course_id_updated_at_idx` ON `practice_sessions` (`course_id`, `updated_at`);
