PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0000_create_briefings.sql','2026-06-25 23:49:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0001_briefing_jobs_cache_insights.sql','2026-06-26 00:12:19');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0002_calendar_events.sql','2026-06-26 07:31:58');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0003_calendar_events_enhance.sql','2026-06-26 07:52:06');
CREATE TABLE `briefings` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`institution` text NOT NULL,
	`professor` text NOT NULL,
	`rmp_rating` text NOT NULL,
	`rmp_count` integer,
	`workload` text NOT NULL,
	`weekly_hours` text,
	`prereq_readiness` text NOT NULL,
	`grade_structure` text NOT NULL,
	`recommendation` text NOT NULL,
	`sources` text NOT NULL,
	`researched_at` text NOT NULL
);
CREATE TABLE `briefing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`course_code` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`frozen_context` text NOT NULL,
	`context_hash` text NOT NULL,
	`cache_key` text NOT NULL,
	`output` text,
	`error_code` text,
	`error_message` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`expires_at` text NOT NULL,
	`completed_at` text
);
INSERT INTO "briefing_jobs" ("id","course_code","status","frozen_context","context_hash","cache_key","output","error_code","error_message","created_at","started_at","expires_at","completed_at") VALUES('3e86742e-e194-4c6a-8309-dba1356837b4','CSIS 3560','failed','{"courseCode":"CSIS 3560","professorName":"Gabriel Vitus","institution":"Douglas college","researchedAt":"2026-06-27T20:22:03.798Z"}','61d50b8fe2cedbc934a35ea2252de488d2cfc4d690d6f7f3764fa7d6bd1efa5b','briefing:CSIS 3560:61d50b8fe2cedbc934a35ea2252de488d2cfc4d690d6f7f3764fa7d6bd1efa5b',NULL,'NO_API_KEY','OpenRouter API key not configured','2026-06-27T20:22:03.798Z',NULL,'2026-06-27T20:52:03.798Z','2026-06-27T20:22:03.855Z');
INSERT INTO "briefing_jobs" ("id","course_code","status","frozen_context","context_hash","cache_key","output","error_code","error_message","created_at","started_at","expires_at","completed_at") VALUES('ed38c234-4953-4cb3-9913-9f6d4ec17553','CSIS 3560','canceled','{"courseCode":"CSIS 3560","professorName":"Gabriel Vitus","institution":"Douglas College","researchedAt":"2026-06-27T20:33:31.748Z"}','5b5900249f357c68b3df6d9c3589f8d51e7f317be5f7fb8955693baeacc5898f','briefing:CSIS 3560:5b5900249f357c68b3df6d9c3589f8d51e7f317be5f7fb8955693baeacc5898f',NULL,NULL,NULL,'2026-06-27T20:33:31.748Z','2026-06-27T20:33:32.028Z','2026-06-27T21:03:31.748Z','2026-06-27T20:37:46.368Z');
INSERT INTO "briefing_jobs" ("id","course_code","status","frozen_context","context_hash","cache_key","output","error_code","error_message","created_at","started_at","expires_at","completed_at") VALUES('3f791e83-2275-43be-bd74-a175983faf78','CSIS 3560','canceled','{"courseCode":"CSIS 3560","professorName":"Gabriel Vitus","institution":"Douglas College","researchedAt":"2026-06-27T20:38:36.519Z"}','5b5900249f357c68b3df6d9c3589f8d51e7f317be5f7fb8955693baeacc5898f','briefing:CSIS 3560:5b5900249f357c68b3df6d9c3589f8d51e7f317be5f7fb8955693baeacc5898f',NULL,NULL,NULL,'2026-06-27T20:38:36.519Z','2026-06-27T20:38:36.562Z','2026-06-27T21:08:36.519Z','2026-06-27T21:03:04.886Z');
CREATE TABLE `insights` (
	`id` text PRIMARY KEY NOT NULL,
	`course_code` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`priority` integer,
	`category` text,
	`sources` text,
	`context_hash` text,
	`created_at` text NOT NULL
);
CREATE TABLE `prompt_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`output` text NOT NULL,
	`sources` text,
	`model_used` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`course_code` text NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'assignment' NOT NULL,
	`date` integer NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`time` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
, `grade_weight` integer, `status` text DEFAULT 'pending', `notes` text);
CREATE TABLE `academic_digest` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`file_name` text,
	`summary` text NOT NULL,
	`total_gpa` text NOT NULL,
	`projected_gpa` text NOT NULL,
	`current_course_count` integer NOT NULL,
	`finished_course_count` integer NOT NULL,
	`current_credits` integer NOT NULL,
	`finished_credits` integer NOT NULL,
	`courses` text NOT NULL,
	`trend` text NOT NULL,
	`insights` text NOT NULL,
	`extraction_source` text NOT NULL,
	`updated_at` text NOT NULL
);
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`semester_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`instructor` text,
	`credits` integer,
	`tag` text,
	`color` text,
	`signals` text
);
INSERT INTO "courses" ("id","semester_id","code","name","instructor","credits","tag","color","signals") VALUES('80ed68b5-9a49-4a6a-b6c0-b0071a2a2724','f26','csis','Cloud Computing','',NULL,'','',NULL);
CREATE TABLE `graph_state` (
	`id` text PRIMARY KEY NOT NULL,
	`positions` text NOT NULL,
	`viewport` text,
	`edges` text NOT NULL
);
CREATE TABLE `semesters` (
	`id` text PRIMARY KEY NOT NULL,
	`term` text NOT NULL,
	`year` integer NOT NULL,
	`order` integer NOT NULL
);
INSERT INTO "semesters" ("id","term","year","order") VALUES('f26','Fall',2026,20261);
CREATE TABLE `syllabus_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`file_name` text NOT NULL,
	`raw_text` text NOT NULL,
	`extracted_data` text NOT NULL,
	`status` text DEFAULT 'mocked' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',4);
