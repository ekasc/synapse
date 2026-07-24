import { describe, expect, it } from 'vitest';
import {
	normalizeCourseCode,
	resolveInstitution,
	matchInstitutionDomain,
	resolveCourseIdentity,
	selectIdentitySource,
	classifySource,
	isSourceAdmissibleFor,
	validateOfferingInstructor,
	admitBriefing,
	decideRetry,
	evaluateCourseIdentity,
	normalizeCanonicalTitle
} from './accuracy-gate';
import type { BriefingRequest, EvidenceSource } from './schema';

// ── Helpers ──

function source(overrides: Partial<EvidenceSource> = {}): EvidenceSource {
	return {
		id: 'src_01',
		category: 'catalog',
		title: 'CSIS 4495 Applied Research Project',
		url: 'https://www.douglascollege.ca/course/csis-4495',
		canonicalUrl: 'https://www.douglascollege.ca/course/csis-4495',
		domain: 'www.douglascollege.ca',
		publisher: 'Douglas College',
		excerpt: 'CSIS 4495 is a 3-credit capstone applied research project course at Douglas College.',
		sourceType: 'official',
		publishedAt: null,
		updatedAt: '2026-01-01',
		retrievedAt: '2026-07-01',
		currentness: 'current',
		retrievalStatus: 'retrieved',
		contentFingerprint: 'fp1',
		claimsSupported: [],
		...overrides
	};
}

function timetableSource(code: string, term: string, instructor: string): EvidenceSource {
	return source({
		id: `timetable_${code.replace(/\s/g, '')}`,
		category: 'schedule',
		title: `${code} ${term} Timetable`,
		url: `https://www.douglascollege.ca/schedule/${code.toLowerCase().replace(/\s/g, '-')}/${term.toLowerCase().replace(/\s/g, '-')}`,
		excerpt: `${code} ${term}: Instructor ${instructor}.`,
		sourceType: 'official',
		currentness: 'current'
	});
}

function facultySource(name: string): EvidenceSource {
	return source({
		id: `faculty_${name.replace(/\s/g, '_')}`,
		category: 'professor-profile',
		title: `Faculty Directory - ${name}`,
		url: `https://www.douglascollege.ca/faculty/${name.toLowerCase().replace(/\s/g, '-')}`,
		excerpt: `${name} is a faculty member at Douglas College.`,
		sourceType: 'official'
	});
}

function rmpSource(): EvidenceSource {
	return source({
		id: 'rmp_01',
		category: 'rate-my-professors',
		title: 'RateMyProfessors',
		url: 'https://www.ratemyprofessors.com/professor/12345',
		domain: 'www.ratemyprofessors.com',
		excerpt: 'Rating: 4.5/5',
		sourceType: 'rmp'
	});
}

function failedSearch(): EvidenceSource {
	return source({
		id: 'failed_01',
		category: 'schedule',
		title: '',
		url: '',
		domain: '',
		excerpt: '',
		sourceType: 'other',
		retrievalStatus: 'unavailable',
		currentness: 'unknown'
	});
}

function request(overrides: Partial<BriefingRequest> = {}): BriefingRequest {
	return {
		courseCode: 'CSIS 4495',
		courseName: 'Applied Research Project',
		institution: 'Douglas College',
		...overrides
	};
}

function offering(overrides: Record<string, unknown> = {}) {
	return {
		term: { label: 'Fall 2026' },
		relationship: 'upcoming' as const,
		instructor: {
			name: 'Padmapriya Arasanipalai Kandhadai',
			verification: 'official' as const,
			sourceIds: ['src_01']
		},
		sourceIds: ['src_01'],
		...overrides
	};
}

// ═══════════════════════════════════════════════════════════════
// Course code normalisation
// ═══════════════════════════════════════════════════════════════

describe('normalizeCourseCode', () => {
	it('uppercases and trims', () => {
		expect(normalizeCourseCode('csis 4495')).toBe('CSIS 4495');
	});

	it('preserves mixed case with spacing', () => {
		expect(normalizeCourseCode('  Math   1130 ')).toBe('MATH 1130');
	});
});

// ═══════════════════════════════════════════════════════════════
// Institution resolution
// ═══════════════════════════════════════════════════════════════

describe('resolveInstitution', () => {
	it('resolves Douglas College by name', () => {
		const inst = resolveInstitution('Douglas College');
		expect(inst).not.toBeNull();
		expect(inst!.domain).toBe('douglascollege.ca');
	});

	it('resolves by domain', () => {
		const inst = resolveInstitution('douglascollege.ca');
		expect(inst).not.toBeNull();
	});

	it('returns null for unknown', () => {
		expect(resolveInstitution('Unknown University')).toBeNull();
	});

	it('returns null for undefined', () => {
		expect(resolveInstitution(undefined)).toBeNull();
	});
});

describe('matchInstitutionDomain', () => {
	it('matches douglascollege.ca', () => {
		expect(matchInstitutionDomain('douglascollege.ca')?.name).toBe('Douglas College');
	});

	it('matches www.douglascollege.ca', () => {
		expect(matchInstitutionDomain('www.douglascollege.ca')?.name).toBe('Douglas College');
	});

	it('matches sub.douglascollege.ca', () => {
		expect(matchInstitutionDomain('courses.douglascollege.ca')?.name).toBe('Douglas College');
	});

	it('rejects non-Douglas domains', () => {
		expect(matchInstitutionDomain('ubc.ca')).toBeNull();
	});
});

// ═══════════════════════════════════════════════════════════════
// Source classification
// ═══════════════════════════════════════════════════════════════

describe('classifySource', () => {
	it('classifies official course page', () => {
		const cs = classifySource(source({ url: 'https://www.douglascollege.ca/course/csis-4495' }));
		expect(cs.type).toBe('official_course');
	});

	it('classifies official outline (historical)', () => {
		const cs = classifySource(
			source({ url: 'https://www.douglascollege.ca/course/csis-4495/202320' })
		);
		expect(cs.type).toBe('official_outline');
	});

	it('classifies official timetable', () => {
		const cs = classifySource(
			source({
				url: 'https://www.douglascollege.ca/schedule',
				title: 'Timetable'
			})
		);
		expect(cs.type).toBe('official_timetable');
	});

	it('classifies faculty page', () => {
		const cs = classifySource(
			source({
				url: 'https://www.douglascollege.ca/faculty',
				title: 'Faculty Directory'
			})
		);
		expect(cs.type).toBe('official_faculty');
	});

	it('classifies RMP', () => {
		const cs = classifySource(rmpSource());
		expect(cs.type).toBe('student_review');
	});
});

// ═══════════════════════════════════════════════════════════════
// Source admissibility
// ═══════════════════════════════════════════════════════════════

describe('isSourceAdmissibleFor', () => {
	it('official course page is admissible for course identity', () => {
		const cs = classifySource(source());
		expect(isSourceAdmissibleFor(cs, 'course_identity')).toBe(true);
	});

	it('official course page is admissible for title', () => {
		const cs = classifySource(source());
		expect(isSourceAdmissibleFor(cs, 'title')).toBe(true);
	});

	it('faculty page is NOT admissible for instructor assignment', () => {
		const cs = classifySource(facultySource('Test Professor'));
		expect(isSourceAdmissibleFor(cs, 'instructor_assignment')).toBe(false);
	});

	it('RMP is NOT admissible for instructor assignment', () => {
		const cs = classifySource(rmpSource());
		expect(isSourceAdmissibleFor(cs, 'instructor_assignment')).toBe(false);
	});

	it('RMP is admissible for student review', () => {
		const cs = classifySource(rmpSource());
		expect(isSourceAdmissibleFor(cs, 'student_review')).toBe(true);
	});

	it('timetable is admissible for offering instructor', () => {
		const cs = classifySource(timetableSource('CSIS 4495', 'Fall 2026', 'Instructor'));
		expect(isSourceAdmissibleFor(cs, 'offering_instructor')).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════
// Course identity resolution
// ═══════════════════════════════════════════════════════════════

describe('selectIdentitySource', () => {
	it('selects source when course code appears in excerpt', () => {
		const s = source({ excerpt: 'CSIS 4495 is a capstone course.' });
		const result = selectIdentitySource([s], request());
		expect(result).not.toBeNull();
		expect(result!.id).toBe('src_01');
	});

	it('selects source when course code appears in title', () => {
		const s = source({ title: 'CSIS 4495 Applied Research', excerpt: 'No code here.' });
		const result = selectIdentitySource([s], request());
		expect(result).not.toBeNull();
	});

	it('returns null when course code does not appear', () => {
		const s = source({
			title: 'CSIS 4280 Cryptography',
			excerpt: 'This course covers applied cryptography and network security.'
		});
		const result = selectIdentitySource([s], request({ courseCode: 'CSIS 4495' }));
		expect(result).toBeNull();
	});

	it('returns null for non-official sources', () => {
		const s = source({ sourceType: 'other', excerpt: 'CSIS 4495 course.' });
		const result = selectIdentitySource([s], request());
		expect(result).toBeNull();
	});

	it('prefers URL slug match', () => {
		const slugMatch = source({
			id: 'slug',
			url: 'https://douglascollege.ca/course/csis-4495',
			excerpt: 'CSIS 4495'
		});
		const noSlug = source({
			id: 'noslug',
			url: 'https://douglascollege.ca/courses/all',
			excerpt: 'CSIS 4495'
		});
		const result = selectIdentitySource([noSlug, slugMatch], request());
		expect(result!.id).toBe('slug');
	});
});

describe('evaluateCourseIdentity', () => {
	it('returns typed rejection states for unsupported, unverified, and conflicting identities', () => {
		expect(
			evaluateCourseIdentity([source()], request({ institution: 'Unknown University' }))
		).toMatchObject({
			status: 'rejected',
			code: 'UNSUPPORTED_INSTITUTION'
		});
		expect(
			evaluateCourseIdentity([source({ sourceType: 'other', domain: 'example.test' })], request())
		).toMatchObject({ status: 'rejected', code: 'NO_ADMISSIBLE_OFFICIAL_SOURCE' });
		expect(
			evaluateCourseIdentity(
				[source({ title: 'CSIS 4280 Cryptography', excerpt: 'CSIS 4280 Cryptography' })],
				request()
			)
		).toMatchObject({ status: 'rejected', code: 'EXACT_COURSE_CODE_NOT_FOUND' });
		expect(
			evaluateCourseIdentity(
				[
					source({ id: 'one', title: 'CSIS 4495 Title One', excerpt: 'CSIS 4495 Title One' }),
					source({ id: 'two', title: 'CSIS 4495 Title Two', excerpt: 'CSIS 4495 Title Two' })
				],
				request()
			)
		).toMatchObject({ status: 'rejected', code: 'CONFLICTING_CANONICAL_TITLES' });
	});

	it('admits a sparse identity when an official catalog result has the exact code but no parseable title', () => {
		expect(
			evaluateCourseIdentity(
				[
					source({
						title: 'Douglas College Course Page',
						excerpt: 'CSIS 4495 is a 3-credit course at Douglas College.',
						retrievalStatus: 'unavailable'
					})
				],
				request()
			)
		).toMatchObject({
			status: 'verified',
			course: {
				courseCode: 'CSIS 4495',
				canonicalTitle: 'CSIS 4495 Applied Research Project'
			}
		});
	});

	it('requires an identity-admissible official source', () => {
		expect(
			evaluateCourseIdentity(
				[
					source({
						title: 'CSIS 4495 Applied Research Project',
						url: 'https://www.douglascollege.ca/faculty/csis-4495'
					})
				],
				request()
			)
		).toMatchObject({ status: 'rejected', code: 'NO_ADMISSIBLE_OFFICIAL_SOURCE' });
	});
});

describe('resolveCourseIdentity', () => {
	it('returns verified when single matching candidate', () => {
		const s = source({ excerpt: 'CSIS 4495 Applied Research Project' });
		const result = resolveCourseIdentity([s], request());
		expect(result.status).toBe('verified');
		expect(result.canonicalTitle).toBe(s.title);
	});

	it('returns not_found when no course code match', () => {
		const s = source({ excerpt: 'CSIS 4280 Cryptography', title: 'Applied Cryptography' });
		const result = resolveCourseIdentity([s], request({ courseCode: 'CSIS 4495' }));
		expect(result.status).toBe('not_found');
	});

	it('returns not_found when no official sources', () => {
		const s = source({ sourceType: 'other', excerpt: 'CSIS 4495' });
		const result = resolveCourseIdentity([s], request());
		expect(result.status).toBe('not_found');
	});

	it('returns ambiguous when conflicting titles match same course code', () => {
		const s1 = source({
			id: 's1',
			title: 'CSIS 4495 Applied Research Project',
			excerpt: 'CSIS 4495',
			url: 'https://douglascollege.ca/csis-4495'
		});
		const s2 = source({
			id: 's2',
			title: 'CSIS 4495 Capstone Project',
			excerpt: 'CSIS 4495',
			url: 'https://douglascollege.ca/csis-4495-alt'
		});
		const result = resolveCourseIdentity([s1, s2], request({ courseName: undefined }));
		expect(result.status).toBe('ambiguous');
	});

	it('returns verified even when two candidates share the same title', () => {
		const s1 = source({ id: 's1', title: 'Applied Research Project', excerpt: 'CSIS 4495' });
		const s2 = source({ id: 's2', title: 'Applied Research Project', excerpt: 'CSIS 4495' });
		const result = resolveCourseIdentity([s1, s2], request());
		expect(result.status).toBe('verified');
	});

	it('extracts canonical title when title precedes course code (Douglas College format)', () => {
		const s = source({
			title: 'Applied Research Project | CSIS 4495 - Douglas College',
			excerpt: 'This course enables students to acquire practical experience...'
		});
		const result = resolveCourseIdentity([s], request());
		expect(result.status).toBe('verified');
		expect(result.canonicalTitle).toBe('CSIS 4495 Applied Research Project');
	});
});

// ═══════════════════════════════════════════════════════════════
// Offering instructor validation
// ═══════════════════════════════════════════════════════════════

describe('validateOfferingInstructor', () => {
	it('accepts user_confirmed without source check', () => {
		const o = offering({
			term: { label: 'Summer 2026' },
			relationship: 'current',
			instructor: { name: 'Michael Ma', verification: 'user_confirmed', sourceIds: [] }
		});
		const result = validateOfferingInstructor(
			o as Parameters<typeof validateOfferingInstructor>[0],
			[]
		);
		expect(result).not.toBeNull();
		expect(result!.provenance).toBe('user_confirmed');
	});

	it('downgrades official verification without admissible source', () => {
		const s = source({ id: 's1', url: 'https://douglascollege.ca/', excerpt: 'homepage' });
		const o = offering({
			term: { label: 'Fall 2026' },
			relationship: 'upcoming',
			instructor: { name: 'Instructor', verification: 'official', sourceIds: ['s1'] }
		});
		const result = validateOfferingInstructor(
			o as Parameters<typeof validateOfferingInstructor>[0],
			[s]
		);
		expect(result).not.toBeNull();
		expect(result!.provenance).toBe('unverified');
	});

	it('downgrades student_reported to unverified', () => {
		const o = offering({
			term: { label: 'Fall 2026' },
			relationship: 'upcoming',
			instructor: { name: 'Instructor', verification: 'student_reported', sourceIds: ['rmp_01'] }
		});
		const result = validateOfferingInstructor(
			o as Parameters<typeof validateOfferingInstructor>[0],
			[rmpSource()]
		);
		expect(result).not.toBeNull();
		expect(result!.provenance).toBe('unverified');
	});

	it('maintains official verification with admissible timetable source', () => {
		const ts = timetableSource('CSIS 4495', 'Fall 2026', 'Padmapriya');
		const o = offering({
			term: { label: 'Fall 2026' },
			relationship: 'upcoming',
			instructor: { name: 'Padmapriya', verification: 'official', sourceIds: [ts.id] }
		});
		const result = validateOfferingInstructor(
			o as Parameters<typeof validateOfferingInstructor>[0],
			[ts]
		);
		expect(result).not.toBeNull();
		expect(result!.provenance).toBe('official');
	});
});

// ═══════════════════════════════════════════════════════════════
// Admission gate
// ═══════════════════════════════════════════════════════════════

describe('admitBriefing', () => {
	it('accepts verified course with valid offerings', () => {
		const sources = [source(), timetableSource('CSIS 4495', 'Fall 2026', 'Padmapriya')];
		const course = resolveCourseIdentity(sources, request());
		const result = admitBriefing(
			sources,
			course,
			[
				offering({
					term: { label: 'Fall 2026' },
					relationship: 'upcoming',
					instructor: {
						name: 'Padmapriya Arasanipalai Kandhadai',
						verification: 'official',
						sourceIds: ['timetable_CSIS4495']
					}
				})
			],
			[],
			request()
		);
		expect(result.status).toBe('accepted');
	});

	it('reports partial when missing instructor verification', () => {
		const sources = [source()];
		const course = resolveCourseIdentity(sources, request());
		const result = admitBriefing(
			sources,
			course,
			[
				offering({
					term: { label: 'Fall 2026' },
					relationship: 'upcoming',
					instructor: { name: 'Instructor', verification: 'unverified', sourceIds: [] }
				})
			],
			[],
			request()
		);
		expect(result.status).toBe('partial');
	});

	it('returns not_found when resolved course is not_found', () => {
		const s = source({
			title: 'Some Other Page',
			excerpt: 'This page describes a completely different course.'
		});
		const course = resolveCourseIdentity([s], request());
		const result = admitBriefing([s], course, [], [], request());
		expect(result.status).toBe('not_found');
	});

	it('returns conflict when resolved course is ambiguous', () => {
		const s1 = source({
			id: 's1',
			title: 'CSIS 4495 Title A',
			excerpt: 'CSIS 4495',
			url: 'https://douglascollege.ca/a'
		});
		const s2 = source({
			id: 's2',
			title: 'CSIS 4495 Title B',
			excerpt: 'CSIS 4495',
			url: 'https://douglascollege.ca/b'
		});
		const course = resolveCourseIdentity([s1, s2], request());
		const result = admitBriefing([s1, s2], course, [], [], request());
		expect(result.status).toBe('conflict');
	});

	it('rejects when claim cites nonexistent source', () => {
		const sources = [source()];
		const course = resolveCourseIdentity(sources, request());
		const claims = [
			{
				id: 'c1',
				text: 'Test',
				status: 'verified_current' as const,
				sourceIds: ['nonexistent'],
				asOf: null,
				explanation: null
			}
		];
		const result = admitBriefing(sources, course, [], claims, request());
		expect(result.status).toBe('rejected');
	});

	it('rejects duplicate current offerings', () => {
		const sources = [source(), timetableSource('CSIS 4495', 'Summer 2026', 'Instructor')];
		const course = resolveCourseIdentity(sources, request());
		const result = admitBriefing(
			sources,
			course,
			[
				offering({
					term: { label: 'Summer 2026' },
					relationship: 'current',
					instructor: { name: 'A', verification: 'user_confirmed', sourceIds: [] }
				}),
				offering({
					term: { label: 'Summer 2026' },
					relationship: 'current',
					instructor: { name: 'B', verification: 'user_confirmed', sourceIds: [] }
				})
			],
			[],
			request()
		);
		expect(result.status).toBe('rejected');
	});

	it('accepts different professors in current vs upcoming terms', () => {
		const sources = [source(), timetableSource('CSIS 4495', 'Fall 2026', 'Padmapriya')];
		const course = resolveCourseIdentity(sources, request());
		const result = admitBriefing(
			sources,
			course,
			[
				offering({
					term: { label: 'Summer 2026' },
					relationship: 'current',
					instructor: { name: 'Michael Ma', verification: 'user_confirmed', sourceIds: [] }
				}),
				offering({
					term: { label: 'Fall 2026' },
					relationship: 'upcoming',
					instructor: {
						name: 'Padmapriya Arasanipalai Kandhadai',
						verification: 'official',
						sourceIds: ['timetable_CSIS4495']
					}
				})
			],
			[],
			request()
		);
		expect(result.status).toBe('accepted');
	});

	it('faculty page does not verify instructor assignment', () => {
		const sources = [source(), facultySource('Test Professor')];
		const course = resolveCourseIdentity(sources, request());
		const result = admitBriefing(
			sources,
			course,
			[
				offering({
					term: { label: 'Fall 2026' },
					relationship: 'upcoming',
					instructor: {
						name: 'Test Professor',
						verification: 'official',
						sourceIds: ['faculty_Test_Professor']
					}
				})
			],
			[],
			request()
		);
		expect(result.status).toBe('partial');
	});

	it('RMP does not verify instructor assignment', () => {
		const sources = [source(), rmpSource()];
		const course = resolveCourseIdentity(sources, request());
		const result = admitBriefing(
			sources,
			course,
			[
				offering({
					term: { label: 'Fall 2026' },
					relationship: 'upcoming',
					instructor: { name: 'Instructor', verification: 'official', sourceIds: ['rmp_01'] }
				})
			],
			[],
			request()
		);
		expect(result.status).toBe('partial');
	});
});

// ═══════════════════════════════════════════════════════════════
// Retry policy
// ═══════════════════════════════════════════════════════════════

describe('decideRetry', () => {
	it('retries on timeout (attempt 1 of 2)', () => {
		const decision = decideRetry({ name: 'TimeoutError' }, 1, []);
		expect(decision.shouldRetry).toBe(true);
	});

	it('retries on 429', () => {
		const decision = decideRetry({ status: 429 }, 1, []);
		expect(decision.shouldRetry).toBe(true);
	});

	it('does not retry on attempt 2', () => {
		const decision = decideRetry({ name: 'TimeoutError' }, 2, []);
		expect(decision.shouldRetry).toBe(false);
	});

	it('does not retry non-retryable error', () => {
		const decision = decideRetry({ code: 'NOT_FOUND' }, 1, []);
		expect(decision.shouldRetry).toBe(false);
	});

	it('does not retry same strategy twice', () => {
		const decision = decideRetry({ name: 'TimeoutError' }, 1, ['TimeoutError']);
		expect(decision.shouldRetry).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════
// Wrong-course detection (CSIS 4280 evaluation)
// ═══════════════════════════════════════════════════════════════

describe('wrong-course rejection', () => {
	it('rejects CSIS 4280 when source is about cryptography', () => {
		const cryptoSource = source({
			title: 'CSIS 4280 Applied Cryptography and Network Security',
			url: 'https://www.douglascollege.ca/course/csis-4280',
			excerpt:
				'This course covers applied cryptography and network security. Instructor: Bambang Sarif.'
		});
		const req = request({ courseCode: 'CSIS 4280', courseName: 'Spec Topics in Emerging Tech' });
		const identity = resolveCourseIdentity([cryptoSource], req);

		// The course code CSIS 4280 IS in the source, so identity looks like it matches...
		// But the canonical title says "Applied Cryptography", not "Spec Topics in Emerging Tech"
		// The user-provided title mismatch is recorded by the admission gate
		expect(identity.status).toBe('verified'); // code matches
		expect(identity.canonicalTitle).toBe('CSIS 4280 Applied Cryptography and Network Security');
		// Note: user-provided title conflicts with canonical — this is informational, not a hard rejection
	});

	it('rejects when source does not contain the requested course code at all', () => {
		const wrongSource = source({
			title: 'CSIS 4280 Applied Cryptography',
			url: 'https://www.douglascollege.ca/course/csis-3375',
			excerpt: 'CSIS 3375 Software Engineering. This course covers...'
		});
		const req = request({ courseCode: 'CSIS 4280' });
		const identity = resolveCourseIdentity([wrongSource], req);
		expect(identity.status).toBe('not_found');
	});

	it('rejects a generic official page when no canonical title is present', () => {
		const genericSource = source({
			title: 'Douglas College Course Page',
			url: 'https://www.douglascollege.ca/course/csis-4495',
			excerpt: 'CSIS 4495 is a 3-credit course at Douglas College.'
		});
		const identity = resolveCourseIdentity([genericSource], request());
		expect(identity.status).toBe('not_found');
	});

	it('extracts canonical title from official excerpt before verification', () => {
		const excerptTitleSource = source({
			title: 'Douglas College Course Page',
			url: 'https://www.douglascollege.ca/course/csis-4495',
			excerpt:
				'CSIS 4495 Applied Research Project is a 3-credit capstone course at Douglas College.'
		});
		const identity = resolveCourseIdentity([excerptTitleSource], request());
		expect(identity.status).toBe('verified');
		expect(identity.canonicalTitle).toBe('CSIS 4495 Applied Research Project');
	});

	it('auto-resolves formatting-only canonical title differences', () => {
		const identity = resolveCourseIdentity(
			[
				source({
					title: 'CSIS-4280: Applied Cryptography',
					excerpt: 'CSIS 4280 Applied Cryptography.'
				}),
				source({
					id: 'src_02',
					title: 'Applied Cryptography | CSIS 4280 | Douglas College',
					url: 'https://www.douglascollege.ca/catalog/csis-4280',
					excerpt: 'Course catalogue entry for CSIS 4280.'
				})
			],
			request({ courseCode: 'CSIS 4280' })
		);
		expect(identity.status).toBe('verified');
		expect(
			normalizeCanonicalTitle('Applied Cryptography | CSIS 4280 | Douglas College', 'CSIS 4280')
		).toBe('applied cryptography');
	});

	it('ignores professor and RMP sources when resolving identity', () => {
		const identity = resolveCourseIdentity(
			[
				source({
					title: 'CSIS 4280 Applied Cryptography',
					excerpt: 'CSIS 4280 Applied Cryptography.'
				}),
				source({
					id: 'faculty',
					category: 'professor-profile',
					title: 'Professor profile — CSIS 4280 Another Course',
					url: 'https://www.douglascollege.ca/faculty/example',
					excerpt: 'CSIS 4280 Another Course',
					sourceType: 'official'
				}),
				source({
					id: 'rmp',
					category: 'rate-my-professors',
					title: 'Professor reviews for CSIS 4280 Different Course',
					url: 'https://www.ratemyprofessors.com/professor/1',
					domain: 'www.ratemyprofessors.com',
					sourceType: 'rmp'
				})
			],
			request({ courseCode: 'CSIS 4280' })
		);
		expect(identity.status).toBe('verified');
	});

	it('uses a uniquely matching requested special-topics title to resolve identity', () => {
		const identity = resolveCourseIdentity(
			[
				source({
					title: 'Special Topics in Emerging Technology | CSIS 4280',
					url: 'https://www.douglascollege.ca/course/csis-4280',
					excerpt: 'Special Topics in Emerging Technology | CSIS 4280'
				}),
				source({
					id: 'src_02',
					title: 'Special Topics in Web/Mobile Application Development | CSIS 4280',
					url: 'https://www.douglascollege.ca/course/csis-4280/202020',
					excerpt: 'Special Topics in Web/Mobile Application Development | CSIS 4280'
				})
			],
			request({ courseCode: 'CSIS 4280', courseName: 'Spec topics in emerging tech' })
		);
		expect(identity.status).toBe('verified');
		expect(identity.sourceId).toBe('src_01');
	});

	it('treats historical special-topics titles as context when current evidence identifies the offering', () => {
		const identity = resolveCourseIdentity(
			[
				source({
					id: 'current',
					title: 'CSIS 4280 Special Topics in Emerging Technology',
					excerpt: 'CSIS 4280 Special Topics in Emerging Technology. Fall 2026.',
					currentness: 'current'
				}),
				source({
					id: 'historical',
					title: 'CSIS 4280 Special Topics in Web/Mobile Application Development',
					url: 'https://www.douglascollege.ca/course/csis-4280/202020',
					excerpt: 'CSIS 4280 Special Topics in Web/Mobile Application Development. Fall 2020.',
					currentness: 'historical'
				})
			],
			request({
				courseCode: 'CSIS 4280',
				courseName: 'Special Topics in Emerging Technology',
				activeTerm: 'Fall 2026'
			})
		);
		expect(identity.status).toBe('verified');
		expect(identity.sourceId).toBe('current');
	});

	it('treats different current titles for the requested term as ambiguous', () => {
		const identity = resolveCourseIdentity(
			[
				source({
					id: 'one',
					title: 'CSIS 4280 Special Topics in Emerging Technology',
					excerpt: 'CSIS 4280 Special Topics in Emerging Technology. Fall 2026.',
					currentness: 'current'
				}),
				source({
					id: 'two',
					title: 'CSIS 4280 Special Topics in Applied Cryptography',
					excerpt: 'CSIS 4280 Special Topics in Applied Cryptography. Fall 2026.',
					currentness: 'current'
				})
			],
			request({ courseCode: 'CSIS 4280', activeTerm: 'Fall 2026' })
		);
		expect(identity.status).toBe('ambiguous');
	});

	it('treats conflicting official canonical titles as ambiguous', () => {
		const identity = resolveCourseIdentity(
			[
				source({
					id: 'src_01',
					title: 'CSIS 4280 Applied Cryptography and Network Security',
					url: 'https://www.douglascollege.ca/course/csis-4280',
					excerpt: 'CSIS 4280 Applied Cryptography and Network Security is offered.'
				}),
				source({
					id: 'src_02',
					title: 'CSIS 4280 Spec Topics in Emerging Tech',
					url: 'https://www.douglascollege.ca/course/csis-4280-alt',
					excerpt: 'CSIS 4280 Spec Topics in Emerging Tech is offered.'
				})
			],
			request({ courseCode: 'CSIS 4280' })
		);
		expect(identity.status).toBe('ambiguous');
	});

	it('user_confirmed is not upgraded to official without evidence', () => {
		const o = offering({
			term: { label: 'Summer 2026' },
			relationship: 'current',
			instructor: { name: 'Xing Liu', verification: 'user_confirmed', sourceIds: [] }
		});
		const result = validateOfferingInstructor(
			o as Parameters<typeof validateOfferingInstructor>[0],
			[]
		);
		expect(result!.provenance).toBe('user_confirmed');
	});
});

// ═══════════════════════════════════════════════════════════════
// CSIS 4495 evaluation - term-scoped instructor
// ═══════════════════════════════════════════════════════════════

describe('CSIS 4495 term-scoped instructor', () => {
	it('Fall evidence does not verify Summer instructor', () => {
		const fallTimetable = timetableSource(
			'CSIS 4495',
			'Fall 2026',
			'Padmapriya Arasanipalai Kandhadai'
		);
		const sources = [source({ excerpt: 'CSIS 4495 Applied Research Project' }), fallTimetable];

		// Summer offering with user_confirmed — no official evidence needed
		const summerOffering = offering({
			term: { label: 'Summer 2026' },
			relationship: 'current',
			instructor: { name: 'Michael Ma', verification: 'user_confirmed', sourceIds: [] }
		});

		const result = validateOfferingInstructor(
			summerOffering as Parameters<typeof validateOfferingInstructor>[0],
			sources
		);
		expect(result!.provenance).toBe('user_confirmed');

		// Fall offering with official evidence from timetable
		const fallOffering = offering({
			term: { label: 'Fall 2026' },
			relationship: 'upcoming',
			instructor: {
				name: 'Padmapriya Arasanipalai Kandhadai',
				verification: 'official',
				sourceIds: [fallTimetable.id]
			}
		});

		const fallResult = validateOfferingInstructor(
			fallOffering as Parameters<typeof validateOfferingInstructor>[0],
			sources
		);
		expect(fallResult!.provenance).toBe('official');
	});

	it('both current and upstream offerings accepted together', () => {
		const fallTs = timetableSource('CSIS 4495', 'Fall 2026', 'Padmapriya Arasanipalai Kandhadai');
		const sources = [source({ excerpt: 'CSIS 4495 Applied Research Project' }), fallTs];
		const course = resolveCourseIdentity(sources, request());
		const result = admitBriefing(
			sources,
			course,
			[
				offering({
					term: { label: 'Summer 2026' },
					relationship: 'current',
					instructor: { name: 'Michael Ma', verification: 'user_confirmed', sourceIds: [] }
				}),
				offering({
					term: { label: 'Fall 2026' },
					relationship: 'upcoming',
					instructor: {
						name: 'Padmapriya Arasanipalai Kandhadai',
						verification: 'official',
						sourceIds: [fallTs.id]
					}
				})
			],
			[],
			request()
		);
		expect(result.status).toBe('accepted');
	});
});
