import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ── Output store ──

export const briefings = sqliteTable('briefings', {
	code: text('code').primaryKey(),
	name: text('name').notNull(),
	institution: text('institution').notNull(),
	professor: text('professor').notNull(),
	rmpRating: text('rmp_rating').notNull(),
	rmpCount: integer('rmp_count'),
	workload: text('workload').notNull(),
	weeklyHours: text('weekly_hours'),
	prereqReadiness: text('prereq_readiness').notNull(),
	gradeStructure: text('grade_structure').notNull(), // JSON string
	recommendation: text('recommendation').notNull(),
	sources: text('sources').notNull(), // JSON string
	researchedAt: text('researched_at').notNull()
});

// ── Async job queue ──

export const briefingJobs = sqliteTable('briefing_jobs', {
	id: text('id').primaryKey(),
	courseCode: text('course_code').notNull(),
	status: text('status').notNull().default('queued'), // queued|running|succeeded|failed|canceled
	frozenContext: text('frozen_context').notNull(), // JSON string — context snapshot at creation
	contextHash: text('context_hash').notNull(), // SHA256 of frozen_context
	cacheKey: text('cache_key').notNull(), // for prompt cache lookup
	output: text('output'), // JSON string — result when succeeded
	errorCode: text('error_code'),
	errorMessage: text('error_message'),
	createdAt: text('created_at').notNull(),
	startedAt: text('started_at'),
	expiresAt: text('expires_at').notNull(), // 30min TTL on queued
	completedAt: text('completed_at')
});

// ── Prompt cache (7-day TTL) ──

export const promptCache = sqliteTable('prompt_cache', {
	cacheKey: text('cache_key').primaryKey(),
	output: text('output').notNull(), // JSON string
	sources: text('sources'), // JSON string
	modelUsed: text('model_used'),
	createdAt: text('created_at').notNull(),
	expiresAt: text('expires_at').notNull() // 7-day TTL
});

// ── Insights (for dashboard display) ──

export const insights = sqliteTable('insights', {
	id: text('id').primaryKey(),
	courseCode: text('course_code').notNull(),
	title: text('title').notNull(),
	summary: text('summary').notNull(),
	priority: integer('priority'),
	category: text('category'),
	sources: text('sources'), // JSON string
	contextHash: text('context_hash'),
	createdAt: text('created_at').notNull()
});

export const calendarEvents = sqliteTable('calendar_events', {
	id: text('id').primaryKey(),
	courseCode: text('course_code').notNull(),
	title: text('title').notNull(),
	type: text('type').notNull().default('assignment'), // assignment | midterm | final | quiz | lecture | study_session
	date: integer('date').notNull(), // day of month 1-31
	month: integer('month').notNull(), // 0-11
	year: integer('year').notNull(),
	time: text('time'),
	gradeWeight: integer('grade_weight'), // percentage weight of this event toward final grade
	status: text('status').default('pending'), // pending | completed | at_risk
	notes: text('notes'), // free-text notes
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});
