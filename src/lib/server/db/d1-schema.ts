import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

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
	researchedAt: text('researched_at').notNull(),
	modelUsed: text('model_used').notNull().default('deepseek/deepseek-v4-flash'),
	schemaVersion: integer('schema_version').notNull().default(1),
	briefingJson: text('briefing_json')
});

// ── Async job queue ──

export const briefingJobs = sqliteTable(
	'briefing_jobs',
	{
		id: text('id').primaryKey(),
		courseCode: text('course_code').notNull(),
		status: text('status').notNull().default('queued'),
		frozenContext: text('frozen_context').notNull(),
		contextHash: text('context_hash').notNull(),
		cacheKey: text('cache_key').notNull(),
		activeKey: text('active_key'),
		leaseToken: text('lease_token'),
		clientIpHash: text('client_ip_hash'),
		stageUpdatedAt: text('stage_updated_at'),
		identityCandidates: text('identity_candidates'),
		cacheHit: integer('cache_hit').notNull().default(0),
		output: text('output'),
		errorCode: text('error_code'),
		errorMessage: text('error_message'),
		createdAt: text('created_at').notNull(),
		startedAt: text('started_at'),
		expiresAt: text('expires_at').notNull(),
		completedAt: text('completed_at')
	},
	(table) => [
		uniqueIndex('briefing_jobs_active_key_unique')
			.on(table.activeKey)
			.where(sql`${table.activeKey} IS NOT NULL`),
		index('briefing_jobs_created_at_idx').on(table.createdAt),
		index('briefing_jobs_ip_created_at_idx').on(table.clientIpHash, table.createdAt)
	]
);

export const briefingRequestAttempts = sqliteTable(
	'briefing_request_attempts',
	{
		jobId: text('job_id').notNull(),
		stage: text('stage').notNull(),
		attemptNumber: integer('attempt_number').notNull(),
		responseId: text('response_id'),
		requestedModel: text('requested_model').notNull(),
		actualModel: text('actual_model'),
		provider: text('provider'),
		query: text('query'),
		responseJson: text('response_json'),
		usageJson: text('usage_json').notNull(),
		costMicrodollars: integer('cost_microdollars').notNull().default(0),
		elapsedMs: integer('elapsed_ms').notNull(),
		httpStatus: integer('http_status').notNull(),
		wasRetry: integer('was_retry').notNull().default(0),
		createdAt: text('created_at').notNull()
	},
	(table) => [primaryKey({ columns: [table.jobId, table.stage, table.attemptNumber] })]
);

export const briefingEvidence = sqliteTable(
	'briefing_evidence',
	{
		jobId: text('job_id').notNull(),
		sourceId: text('source_id').notNull(),
		category: text('category').notNull(),
		canonicalUrl: text('canonical_url').notNull(),
		domain: text('domain').notNull(),
		publisher: text('publisher').notNull(),
		publishedAt: text('published_at'),
		updatedAt: text('updated_at'),
		retrievedAt: text('retrieved_at').notNull(),
		currentness: text('currentness').notNull(),
		retrievalStatus: text('retrieval_status').notNull(),
		contentFingerprint: text('content_fingerprint').notNull(),
		claimsSupportedJson: text('claims_supported_json').notNull()
	},
	(table) => [primaryKey({ columns: [table.jobId, table.sourceId] })]
);

export const briefingEvidenceCache = sqliteTable(
	'briefing_evidence_cache',
	{
		cacheKey: text('cache_key').notNull(),
		category: text('category').notNull(),
		evidenceJson: text('evidence_json').notNull(),
		createdAt: text('created_at').notNull(),
		expiresAt: text('expires_at').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.cacheKey, table.category] }),
		index('briefing_evidence_cache_expires_at_idx').on(table.expiresAt)
	]
);

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

// ── Semesters ──

export const semesters = sqliteTable('semesters', {
	id: text('id').primaryKey(),
	term: text('term').notNull(),
	year: integer('year').notNull(),
	order: integer('order').notNull()
});

// ── Courses (signals stored as JSON string) ──

export const courses = sqliteTable('courses', {
	id: text('id').primaryKey(),
	semesterId: text('semester_id').notNull(),
	code: text('code').notNull(),
	name: text('name').notNull(),
	instructor: text('instructor'),
	credits: integer('credits'),
	tag: text('tag'),
	color: text('color'),
	signals: text('signals')
});

// ── Graph state (single row, JSON fields) ──

export const graphState = sqliteTable('graph_state', {
	id: text('id').primaryKey(),
	positions: text('positions').notNull(),
	viewport: text('viewport'),
	edges: text('edges').notNull()
});

// ── Course Map planning scenarios ──

export const planningScenarios = sqliteTable(
	'planning_scenarios',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		revision: integer('revision').notNull().default(1),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [check('planning_scenarios_revision_check', sql`${table.revision} >= 1`)]
);

export const planningScenarioMoves = sqliteTable(
	'planning_scenario_moves',
	{
		scenarioId: text('scenario_id')
			.notNull()
			.references(() => planningScenarios.id, { onDelete: 'cascade' }),
		moveOrder: integer('move_order').notNull(),
		courseId: text('course_id').notNull(),
		targetSemesterId: text('target_semester_id').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.scenarioId, table.moveOrder] }),
		index('planning_scenario_moves_order_idx').on(table.scenarioId, table.moveOrder)
	]
);

// ── Syllabus imports (extracted_data as JSON) ──

export const syllabusImports = sqliteTable('syllabus_imports', {
	id: text('id').primaryKey(),
	courseId: text('course_id').notNull(),
	fileName: text('file_name').notNull(),
	rawText: text('raw_text').notNull(),
	extractedData: text('extracted_data').notNull(),
	status: text('status').notNull().default('mocked'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

// ── Academic digest (single row, JSON fields) ──

export const academicDigest = sqliteTable('academic_digest', {
	id: text('id').primaryKey(),
	source: text('source').notNull(),
	fileName: text('file_name'),
	summary: text('summary').notNull(),
	totalGpa: text('total_gpa').notNull(),
	projectedGpa: text('projected_gpa').notNull(),
	currentCourseCount: integer('current_course_count').notNull(),
	finishedCourseCount: integer('finished_course_count').notNull(),
	currentCredits: integer('current_credits').notNull(),
	finishedCredits: integer('finished_credits').notNull(),
	courses: text('courses').notNull(),
	trend: text('trend').notNull(),
	insights: text('insights').notNull(),
	extractionSource: text('extraction_source').notNull(),
	updatedAt: text('updated_at').notNull()
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

export const practiceMaterialIndexes = sqliteTable(
	'practice_material_indexes',
	{
		materialId: text('material_id').primaryKey(),
		courseId: text('course_id').notNull(),
		status: text('status').notNull().default('pending'),
		pageCount: integer('page_count'),
		nextPage: integer('next_page').notNull().default(1),
		characterCount: integer('character_count').notNull().default(0),
		errorMessage: text('error_message'),
		indexVersion: integer('index_version').notNull().default(1),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		check(
			'practice_material_indexes_status_check',
			sql`${table.status} IN ('pending', 'indexing', 'ready', 'needs_ocr', 'unsupported', 'failed', 'too_large')`
		),
		check('practice_material_indexes_next_page_check', sql`${table.nextPage} >= 1`),
		check('practice_material_indexes_character_count_check', sql`${table.characterCount} >= 0`),
		index('practice_material_indexes_course_status_idx').on(table.courseId, table.status)
	]
);

export const practiceMaterialChunks = sqliteTable(
	'practice_material_chunks',
	{
		id: text('id').primaryKey(),
		materialId: text('material_id').notNull(),
		courseId: text('course_id').notNull(),
		chunkIndex: integer('chunk_index').notNull(),
		pageStart: integer('page_start'),
		pageEnd: integer('page_end'),
		text: text('text').notNull(),
		normalizedText: text('normalized_text').notNull(),
		createdAt: text('created_at').notNull()
	},
	(table) => [
		uniqueIndex('practice_material_chunks_material_chunk_idx').on(
			table.materialId,
			table.chunkIndex
		),
		index('practice_material_chunks_course_material_idx').on(
			table.courseId,
			table.materialId,
			table.chunkIndex
		)
	]
);

export const practiceSessions = sqliteTable(
	'practice_sessions',
	{
		id: text('id').primaryKey(),
		courseId: text('course_id').notNull(),
		courseCode: text('course_code').notNull(),
		sourceMaterials: text('source_materials').notNull(),
		questions: text('questions').notNull(),
		flashcards: text('flashcards').notNull(),
		score: integer('score').notNull().default(0),
		currentQuestionIndex: integer('current_question_index').notNull().default(0),
		missedQuestionIds: text('missed_question_ids').notNull().default('[]'),
		currentCardIndex: integer('current_card_index').notNull().default(0),
		cardSide: text('card_side').notNull().default('front'),
		status: text('status').notNull().default('in_progress'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		check('practice_sessions_score_check', sql`${table.score} >= 0`),
		check(
			'practice_sessions_current_question_index_check',
			sql`${table.currentQuestionIndex} >= 0`
		),
		check('practice_sessions_current_card_index_check', sql`${table.currentCardIndex} >= 0`),
		check('practice_sessions_card_side_check', sql`${table.cardSide} IN ('front', 'back')`),
		check(
			'practice_sessions_status_check',
			sql`${table.status} IN ('in_progress', 'completed', 'paused')`
		),
		index('practice_sessions_course_id_updated_at_idx').on(table.courseId, table.updatedAt)
	]
);
