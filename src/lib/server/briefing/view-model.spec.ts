import { describe, expect, it } from 'vitest';
import { toDetailViewModel } from './view-model';
import type { Briefing } from '$lib/server/db/d1';

function makeV4Briefing(overrides: Partial<Record<string, unknown>> = {}): Briefing {
	const v4Report: Record<string, unknown> = {
		schemaVersion: 4,
		identity: {
			courseCode: 'CSIS 3560',
			title: 'Cybersecurity',
			institution: 'Douglas College',
			officialDomain: 'douglascollege.ca',
			confidence: 'high'
		},
		instructor: {
			requestedName: 'Gabriel Vitus',
			name: 'Bambang Sarif',
			status: 'contradicted',
			detail: 'Fall 2026 timetable lists Bambang Sarif'
		},
		summary: { text: 'CSIS 3560 covers foundational cybersecurity concepts.', sourceIds: ['s1'] },
		rateMyProfessors: {
			text: '4.5/5',
			sourceIds: ['rmp1'],
			claimIds: []
		},
		description: { text: 'An introduction to cybersecurity.', sourceIds: ['s1'] },
		credits: { text: '3 credits', sourceIds: ['s1'] },
		prerequisites: { text: 'CSIS 2270', sourceIds: ['s1'] },
		corequisites: { text: 'None', sourceIds: [] },
		delivery: { text: 'In-person', sourceIds: ['s2'] },
		workload: { text: 'Moderate workload', sourceIds: ['s3'] },
		assessments: { text: 'Labs, exams, project', sourceIds: ['s4'] },
		claims: [
			{ id: 'c1', text: 'Course includes labs', status: 'verified_current', sourceIds: ['s4'] }
		],
		sources: [
			{
				id: 's1',
				title: 'Official Catalog',
				url: 'https://douglascollege.ca/csis3560',
				sourceType: 'official_catalog'
			},
			{ id: 'rmp1', title: 'RateMyProfessors', url: 'https://rmp.com', sourceType: 'rmp_review' }
		],
		assessmentComponents: [],
		passingRequirements: '',
		contradictions: { text: 'Instructor assignment differs from timetable' },
		missing: { text: '' },
		usage: { inputTokens: 1000, outputTokens: 500, searchRequests: 2, costMicrodollars: 15000 },
		...overrides
	};

	return {
		code: 'CSIS 3560',
		name: 'Cybersecurity',
		institution: 'Douglas College',
		professor: 'Gabriel Vitus',
		rmpRating: '4.5/5',
		rmpCount: 42,
		workload: '',
		weeklyHours: null,
		prereqReadiness: '',
		gradeStructure: [],
		recommendation: '',
		sources: [],
		researchedAt: '2026-07-01T12:00:00Z',
		modelUsed: 'deepseek-v4',
		schemaVersion: 4,
		v4Report
	};
}

describe('toDetailViewModel V4 summary sanitization', () => {
	it('renders a valid summary text unchanged', () => {
		const b = makeV4Briefing();
		const vm = toDetailViewModel(b);
		expect(vm.summary).not.toBeNull();
		expect(vm.summary?.text).toBe('CSIS 3560 covers foundational cybersecurity concepts.');
	});

	it('suppresses summary containing "has taught this course previously per RateMyProfessors tags"', () => {
		const b = makeV4Briefing({
			summary: {
				text: 'Requested professor Gabriel Vitus is a confirmed CSIS faculty member at Douglas College and has taught this course previously per RateMyProfessors tags. This course covers cybersecurity.',
				sourceIds: ['s1']
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
	});

	it('suppresses summary containing "taught ... RateMyProfessors" pattern', () => {
		const b = makeV4Briefing({
			summary: {
				text: 'Gabriel Vitus taught CSIS 3560 according to RateMyProfessors.',
				sourceIds: ['s1']
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
	});

	it('suppresses summary containing "RMP teach" pattern (case insensitive)', () => {
		const b = makeV4Briefing({
			summary: {
				text: 'Based on rmp teaching history, the professor has covered this material before.',
				sourceIds: ['s1']
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
	});

	it('suppresses summary containing "RMP instructor" pattern', () => {
		const b = makeV4Briefing({
			summary: {
				text: 'The rmp instructor assignment shows a mismatch.',
				sourceIds: ['s1']
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
	});

	it('preserves professor requested name after summary suppression', () => {
		const b = makeV4Briefing({
			summary: {
				text: 'Gabriel Vitus has taught this course previously per RateMyProfessors.',
				sourceIds: ['s1']
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
		expect(vm.professor.requestedName).toBe('Gabriel Vitus');
	});

	it('preserves student reviews section after summary suppression', () => {
		const b = makeV4Briefing({
			summary: {
				text: 'Taught previously per RateMyProfessors.',
				sourceIds: ['s1']
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
		expect(vm.studentReviews).not.toBeNull();
		expect(vm.studentReviews?.label).toBe('4.5/5');
		expect(vm.studentReviews?.rmpNote).toBe(
			'Student-reported; not official evidence of teaching history, course identity, assignment, or offering.'
		);
	});

	it('preserves current official instructor contradiction after summary suppression', () => {
		const b = makeV4Briefing({
			summary: {
				text: 'Previously taught per RateMyProfessors.',
				sourceIds: ['s1']
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
		expect(vm.professor.currentListedInstructor).toBe('Bambang Sarif');
		expect(vm.professor.assignmentStatus).toBe('contradicted');
	});

	it('preserves assessment structure after summary suppression', () => {
		const b = makeV4Briefing({
			summary: { text: 'Taught per RateMyProfessors.', sourceIds: ['s1'] }
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
		expect(vm.assessments).not.toBeNull();
		expect(vm.assessments?.text).toBe('Labs, exams, project');
	});

	it('derives assessment table rows from a supported assessment section', () => {
		const b = makeV4Briefing({
			assessments: {
				text: 'Labs: 05% - 10%. Project: 15% – 25%. Midterm: 30% - 40%. Final exam: 35% - 40%.',
				sourceIds: ['s4']
			},
			assessmentComponents: []
		});
		const vm = toDetailViewModel(b);
		expect(
			vm.assessmentComponents?.map(({ label, weightDisplay }) => [label, weightDisplay])
		).toEqual([
			['Labs', '5–10%'],
			['Project', '15–25%'],
			['Midterm', '30–40%'],
			['Final exam', '35–40%']
		]);
	});

	it('derives rows when only the upper assessment range includes a percent sign', () => {
		const b = makeV4Briefing({
			assessments: {
				text: 'Lab activities/assignments 5-10%, Project 15-25%, Midterm 30-40%, Final Exam 35-40% (practical hands-on computer programming exam).',
				sourceIds: ['s4']
			},
			assessmentComponents: []
		});
		expect(
			toDetailViewModel(b).assessmentComponents?.map(({ label, weightDisplay }) => [
				label,
				weightDisplay
			])
		).toEqual([
			['Lab activities/assignments', '5–10%'],
			['Project', '15–25%'],
			['Midterm', '30–40%'],
			['Final Exam', '35–40%']
		]);
	});

	it('preserves passing requirements after summary suppression', () => {
		const b = makeV4Briefing({
			summary: { text: 'RMP taught it.', sourceIds: ['s1'] },
			passingRequirements: [
				{ ruleText: 'Must pass all assessments with 50% or higher.', ruleType: 'minimum_overall' }
			]
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
		expect(vm.passingRequirements).not.toBeNull();
	});

	it('does not suppress summary with RMP mentioned outside teaching context', () => {
		const b = makeV4Briefing({
			summary: {
				text: 'RateMyProfessors rates the professor 4.5/5. The course covers cybersecurity.',
				sourceIds: ['s1']
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).not.toBeNull();
	});

	it('does not suppress summary without RMP reference', () => {
		const b = makeV4Briefing({
			summary: {
				text: 'This course is an introduction to cybersecurity principles and practices.',
				sourceIds: ['s1']
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).not.toBeNull();
	});

	it('returns null summary when v4 summary section is absent', () => {
		const b = makeV4Briefing();
		const v4 = b.v4Report as Record<string, unknown>;
		delete v4.summary;
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
	});

	it('returns null summary when v4 summary text is empty string', () => {
		const b = makeV4Briefing({
			summary: { text: '', sourceIds: ['s1'] }
		});
		const vm = toDetailViewModel(b);
		expect(vm.summary).toBeNull();
	});

	it('maps schema-version 5 reports through the structured path', () => {
		const b = makeV4Briefing();
		b.schemaVersion = 5;
		expect(toDetailViewModel(b).description?.text).toBe('An introduction to cybersecurity.');
	});

	it('V4 rendering is not affected by legacy path', () => {
		const b = makeV4Briefing({
			summary: {
				text: 'A valid V4 summary about cybersecurity.',
				sourceIds: ['s1']
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.schemaVersion).toBe(4);
		expect(vm.isLegacy).toBe(false);
		expect(vm.legacyLabel).toBeNull();
		expect(vm.summary).not.toBeNull();
	});
});

describe('toDetailViewModel V4 professor and RMP separation', () => {
	it('professor requested name is independent of student reviews', () => {
		const b = makeV4Briefing();
		const vm = toDetailViewModel(b);
		expect(vm.professor.requestedName).toBe('Gabriel Vitus');
		expect(vm.studentReviews).not.toBeNull();
		expect(vm.studentReviews?.rating).toBe(4.5);
	});

	it('RMP rating count is preserved', () => {
		const b = makeV4Briefing();
		const vm = toDetailViewModel(b);
		expect(vm.studentReviews?.ratingCount).toBe(42);
	});

	it('student reviews are labelled non-official', () => {
		const b = makeV4Briefing();
		const vm = toDetailViewModel(b);
		expect(vm.studentReviews?.rmpNote).toContain('not official');
		expect(vm.studentReviews?.rmpNote).toContain('teaching history');
	});

	it('maps complete RMP and sentiment fields with field-level supporting sources only', () => {
		const b = makeV4Briefing({
			rmpProfile: {
				profileUrl: 'https://www.ratemyprofessors.com/professor/1',
				displayedName: 'Gabriel Vitus',
				institution: 'Douglas College',
				department: 'CSIS',
				overallRating: 4.5,
				ratingCount: 42,
				wouldTakeAgainPercent: 78,
				difficulty: 3.1,
				themes: ['Helpful'],
				sourceIds: ['rmp1']
			},
			studentSentiment: {
				positives: ['Helpful'],
				concerns: ['Fast pace'],
				sampleSize: 42,
				courseSpecific: false,
				sourceIds: ['rmp1']
			},
			offerings: {
				current: { term: { label: 'Fall 2026' }, relationship: 'current', sourceIds: ['s1'] }
			}
		});
		const vm = toDetailViewModel(b);
		expect(vm.studentReviews).toMatchObject({
			rating: 4.5,
			ratingCount: 42,
			wouldTakeAgainPercent: 78,
			difficulty: 3.1
		});
		expect(vm.studentSentiment).toMatchObject({
			positives: ['Helpful'],
			concerns: ['Fast pace'],
			courseSpecific: false
		});
		expect(vm.sources.map((source) => source.id)).toEqual(expect.arrayContaining(['s1', 'rmp1']));
	});

	it('suppresses persisted mixed evidence instead of exposing it to the compact result', () => {
		const b = makeV4Briefing({
			description: {
				text: 'Instructor last name Xing. Course status Open. Textbook: Mobile Applications.',
				sourceIds: ['s1'],
				claimIds: []
			}
		});
		expect(toDetailViewModel(b).description?.text).toBe('');
	});

	it('maps partial and unavailable details without inventing a rating or sentiment', () => {
		const b = makeV4Briefing({
			rateMyProfessors: { text: '', sourceIds: [], claimIds: [] },
			description: { text: '', sourceIds: [], claimIds: [] }
		});
		const vm = toDetailViewModel(b);
		expect(vm.studentReviews).toBeNull();
		expect(vm.studentSentiment).toBeNull();
		expect(vm.description?.text).toBe('');
	});
});
