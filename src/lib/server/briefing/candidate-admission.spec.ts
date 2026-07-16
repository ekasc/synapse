import { describe, expect, it } from 'vitest';
import { admitCandidateBriefing } from './candidate-admission';
import type { CandidateBriefing } from './research-run';
import type { EvidenceSource } from './schema';
const source: EvidenceSource = {
	id: 'src_01',
	category: 'catalog',
	title: 'CSIS 4495 Applied Research Project',
	url: 'https://www.douglascollege.ca/course/csis-4495',
	canonicalUrl: 'https://www.douglascollege.ca/course/csis-4495',
	domain: 'www.douglascollege.ca',
	publisher: 'Douglas College',
	excerpt: 'CSIS 4495 Applied Research Project is a course.',
	sourceType: 'official',
	publishedAt: null,
	updatedAt: null,
	retrievedAt: '2026-01-01T00:00:00.000Z',
	currentness: 'current',
	retrievalStatus: 'retrieved',
	contentFingerprint: 'x',
	claimsSupported: []
};
const section = { text: '', sourceIds: [], claimIds: [] };
const candidate = (): CandidateBriefing => ({
	schemaVersion: 5,
	identity: {
		code: 'CSIS 4495',
		name: 'CSIS 4495 Applied Research Project',
		institution: 'Douglas College',
		officialDomain: 'douglascollege.ca',
		catalogSourceId: 'src_01',
		candidates: [],
		confidence: 'high',
		verifiedAt: '2026-01-01'
	},
	instructor: { requestedName: null, name: null, status: 'not_requested', sourceIds: [] },
	description: section,
	credits: section,
	prerequisites: section,
	corequisites: section,
	delivery: section,
	assessments: section,
	workload: section,
	rateMyProfessors: section,
	contradictions: section,
	missing: { text: 'Missing optional evidence.', sourceIds: [], claimIds: [] },
	summary: section,
	claims: [],
	sources: [{ ...source }],
	researchedAt: '2026-01-01',
	modelUsed: 'model',
	searchModel: 'search',
	synthesisModel: 'synthesis',
	usage: {
		inputTokens: 0,
		outputTokens: 0,
		reasoningTokens: 0,
		cachedTokens: 0,
		searchRequests: 0,
		costMicrodollars: 0
	}
});
const metadata = {
	researchedAt: '2026-01-01',
	modelUsed: 'model',
	searchModel: 'search',
	synthesisModel: 'synthesis',
	usage: candidate().usage
};
describe('candidate admission', () => {
	it('uses existing validation and admits a verified candidate', () =>
		expect(
			admitCandidateBriefing(
				candidate(),
				{ courseCode: 'CSIS 4495', institution: 'Douglas College' },
				metadata
			)
		).toMatchObject({ status: 'accepted' }));
	it('rejects an identity mismatch before admission', () =>
		expect(
			admitCandidateBriefing(
				{ ...candidate(), identity: { ...candidate().identity, code: 'CSIS 9999' } },
				{ courseCode: 'CSIS 4495', institution: 'Douglas College' },
				metadata
			)
		).toMatchObject({ status: 'rejected' }));
});
