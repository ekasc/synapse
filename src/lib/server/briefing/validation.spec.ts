import { describe, expect, it } from 'vitest';
import {
	normalizeSynthesisCandidate,
	validateCachedBriefingIdentity,
	validateStructuredBriefing,
	ValidationError
} from './validation';
import type { EvidenceSource } from './schema';
const usage = {
	inputTokens: 0,
	outputTokens: 0,
	reasoningTokens: 0,
	cachedTokens: 0,
	searchRequests: 0,
	costMicrodollars: 0
};
const source = (overrides: Partial<EvidenceSource> = {}): EvidenceSource => ({
	id: 'src_01',
	category: 'catalog',
	title: 'CSIS 3375',
	url: 'https://www.douglascollege.ca/course',
	canonicalUrl: 'https://www.douglascollege.ca/course',
	domain: 'www.douglascollege.ca',
	publisher: 'Douglas College',
	excerpt: 'CSIS 3375 Official course',
	sourceType: 'official',
	publishedAt: null,
	updatedAt: '2026-01-01',
	retrievedAt: '2026-07-01',
	currentness: 'current',
	retrievalStatus: 'retrieved',
	contentFingerprint: 'x',
	claimsSupported: [],
	...overrides
});
const section = () => ({ text: 'Supported', sourceIds: ['src_01'], claimIds: ['c1'] });
const value = () => ({
	identity: {
		code: 'CSIS 3375',
		name: 'Software Engineering',
		institution: 'Douglas College',
		officialDomain: 'douglascollege.ca',
		catalogSourceId: 'src_01',
		candidates: [],
		confidence: 'high',
		verifiedAt: '2026-07-01'
	},
	instructor: {
		requestedName: 'Ada',
		name: null,
		status: 'requested_by_user',
		sourceIds: []
	},
	description: { text: 'Course overview', sourceIds: ['src_01'], claimIds: ['c1'] },
	credits: { text: '3 credits', sourceIds: ['src_01'], claimIds: ['c1'] },
	prerequisites: { text: 'CSIS 2260', sourceIds: ['src_01'], claimIds: ['c1'] },
	corequisites: { text: 'None', sourceIds: ['src_01'], claimIds: ['c1'] },
	delivery: { text: 'Lecture', sourceIds: ['src_01'], claimIds: ['c1'] },
	assessments: { text: 'Final exam 100%', sourceIds: ['src_01'], claimIds: ['c1'] },
	workload: section(),
	rateMyProfessors: { text: '', sourceIds: [], claimIds: [] },
	contradictions: { text: '', sourceIds: [], claimIds: [] },
	missing: { text: 'None', sourceIds: [], claimIds: [] },
	summary: section(),
	claims: [
		{
			id: 'c1',
			text: 'Fact',
			status: 'verified_current',
			sourceIds: ['src_01'],
			asOf: '2026-07-01',
			explanation: null
		}
	]
});
const metadata = {
	researchedAt: '2026-07-01',
	modelUsed: 'pro',
	searchModel: 'flash',
	synthesisModel: 'pro',
	usage
};
describe('persistence identity protection', () => {
	it('accepts an official catalog subdomain in a cached briefing', () => {
		const briefing = {
			...value(),
			sources: [
				source({
					title: 'CSIS 3375 Software Engineering',
					excerpt: 'CSIS 3375 Software Engineering'
				})
			]
		};
		briefing.identity.name = 'CSIS 3375 Software Engineering';
		briefing.identity.officialDomain = 'www.douglascollege.ca';
		expect(() =>
			validateCachedBriefingIdentity(briefing as never, {
				courseCode: 'CSIS 3375',
				institution: 'Douglas College'
			})
		).not.toThrow();
	});

	it('rejects a cached briefing whose catalog source is not identity-admissible', () => {
		const briefing = {
			...value(),
			schemaVersion: 5,
			sources: [
				source({
					title: 'CSIS 3375 Software Engineering',
					excerpt: 'CSIS 3375 Software Engineering',
					url: 'https://www.douglascollege.ca/faculty/csis-3375'
				})
			]
		};
		expect(() =>
			validateCachedBriefingIdentity(briefing as never, {
				courseCode: 'CSIS 3375',
				institution: 'Douglas College'
			})
		).toThrow(ValidationError);
	});
});

describe('structured briefing validation', () => {
	it('accepts sourced Douglas evidence and preserves requested instructor name', () =>
		expect(
			validateStructuredBriefing(
				value(),
				[source()],
				{ courseCode: 'CSIS 3375', professorName: 'Ada' },
				metadata
			).instructor.requestedName
		).toBe('Ada'));
	it('normalizes an official instructor status backed by a current official schedule', () => {
		const candidate = value();
		candidate.instructor = {
			requestedName: 'Ada',
			name: 'Ada Lovelace',
			status: 'official',
			sourceIds: ['schedule']
		};
		const sources = [
			source(),
			source({
				id: 'schedule',
				category: 'schedule',
				title: 'CSIS 3375 current schedule',
				excerpt: 'CSIS 3375 instructor Ada Lovelace'
			})
		];
		const request = { courseCode: 'CSIS 3375', professorName: 'Ada' };
		const normalized = normalizeSynthesisCandidate(candidate, sources, request, {
			institution: 'Douglas College',
			courseCode: 'CSIS 3375',
			canonicalTitle: 'Software Engineering',
			canonicalUrl: 'https://www.douglascollege.ca/course',
			sourceId: 'src_01',
			status: 'verified',
			candidates: []
		});
		const result = validateStructuredBriefing(normalized, sources, request, metadata);
		expect(result.instructor.status).toBe('verified_current_official');
	});

	it('rejects invented source IDs', () => {
		const v = value();
		v.summary.sourceIds = ['invented'];
		expect(() =>
			validateStructuredBriefing(
				v,
				[source()],
				{ courseCode: 'CSIS 3375', professorName: 'Ada' },
				metadata
			)
		).toThrow(ValidationError);
	});
	it('rejects non-Douglas identity evidence', () =>
		expect(() =>
			validateStructuredBriefing(
				value(),
				[source({ domain: 'example.edu' })],
				{ courseCode: 'CSIS 3375', professorName: 'Ada', institution: 'Douglas College' },
				metadata
			)
		).toThrow('official catalog source for the requested institution'));
	it('rejects historical current instructors', () =>
		expect(() =>
			validateStructuredBriefing(
				value(),
				[source({ currentness: 'historical' })],
				{ courseCode: 'CSIS 3375', professorName: 'Ada' },
				metadata
			)
		).toThrow('current claims require current evidence'));
	it('accepts one-source instructor assignment contradiction but rejects unrelated one-source contradictions', () => {
		const schedule = source({
			id: 'src_schedule_01',
			category: 'schedule',
			title: 'Current schedule: CSIS 3375 — Bambang Sarif',
			excerpt: 'CSIS 3375 is scheduled with Bambang Sarif',
			claimsSupported: []
		});
		const v = value();
		v.instructor = {
			requestedName: 'Gabriel Vitus',
			name: 'Bambang Sarif',
			status: 'contradicted',
			sourceIds: ['src_schedule_01']
		};
		v.claims[0] = {
			id: 'c1',
			text: 'Gabriel Vitus was requested, but the official schedule assigns Bambang Sarif as instructor.',
			status: 'contradicted',
			sourceIds: ['src_schedule_01'],
			asOf: null,
			explanation: null
		};
		v.contradictions = {
			text: 'Instructor assignment conflict',
			sourceIds: ['src_schedule_01'],
			claimIds: ['c1']
		};
		expect(
			validateStructuredBriefing(
				v,
				[source(), schedule],
				{ courseCode: 'CSIS 3375', professorName: 'Gabriel Vitus', institution: 'Douglas College' },
				metadata
			)
		).toBeTruthy();
		const unconfirmedInstructor = { ...v };
		unconfirmedInstructor.instructor = {
			requestedName: 'Gabriel Vitus',
			name: 'Bambang Sarif',
			status: 'requested_by_user',
			sourceIds: ['src_schedule_01']
		};
		expect(() =>
			validateStructuredBriefing(
				unconfirmedInstructor,
				[source(), schedule],
				{ courseCode: 'CSIS 3375', professorName: 'Gabriel Vitus', institution: 'Douglas College' },
				metadata
			)
		).toThrow('conflicting sources');
	});

	it('requires explanations and sources for inferred claims', () => {
		const v = value();
		v.claims[0] = { ...v.claims[0], status: 'inferred', explanation: null };
		expect(() =>
			validateStructuredBriefing(
				v,
				[source()],
				{ courseCode: 'CSIS 3375', professorName: 'Ada' },
				metadata
			)
		).toThrow('inferred claims');
	});
});
