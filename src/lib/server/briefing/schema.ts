export const BRIEFING_SCHEMA_VERSION = 5 as const;
export const EVIDENCE_BUNDLE_VERSION = 2 as const;

export type EvidenceCategory =
	| 'catalog'
	| 'prerequisites'
	| 'outline'
	| 'schedule'
	| 'professor-course'
	| 'professor-profile'
	| 'rate-my-professors';
export type SourceType = 'official' | 'rmp' | 'other';
export type Currentness = 'current' | 'historical' | 'unknown';

export type EvidenceSource = {
	id: string;
	category: EvidenceCategory;
	title: string;
	url: string;
	canonicalUrl: string;
	domain: string;
	publisher: string;
	excerpt: string;
	sourceType: SourceType;
	publishedAt: string | null;
	updatedAt: string | null;
	retrievedAt: string;
	currentness: Currentness;
	retrievalStatus: 'retrieved' | 'partial' | 'unavailable';
	contentFingerprint: string;
	claimsSupported: string[];
};

export type BriefingUsage = {
	inputTokens: number;
	outputTokens: number;
	reasoningTokens: number;
	cachedTokens: number;
	searchRequests: number;
	costMicrodollars: number;
};

export type BriefingRequest = {
	courseCode: string;
	courseName?: string;
	professorName?: string;
	institution?: string;
	additionalNotes?: string;
	identityChoice?: string;
	activeTerm?: string;
};

export type CourseOffering = {
	term: { id?: string; label: string };
	relationship: 'current' | 'upcoming' | 'historical';
	instructor?: {
		name: string;
		verification: 'official' | 'user_confirmed' | 'student_reported' | 'unverified';
		sourceIds: string[];
	};
	crn?: string;
	section?: string;
	campus?: string;
	modality?: string;
	schedule?: string;
	sourceIds: string[];
};

export type EvidenceBundle = {
	version: typeof EVIDENCE_BUNDLE_VERSION;
	request: BriefingRequest;
	categories: EvidenceCategory[];
	sources: EvidenceSource[];
	missingCategories: EvidenceCategory[];
	usage: BriefingUsage;
};

export type Claim = {
	id: string;
	text: string;
	status:
		| 'verified_current'
		| 'verified_historical'
		| 'supported_non_official'
		| 'inferred'
		| 'unknown'
		| 'contradicted';
	sourceIds: string[];
	asOf: string | null;
	explanation: string | null;
};
export type ReportSection = { text: string; sourceIds: string[]; claimIds: string[] };

export type AssessmentCategory =
	| 'assignments'
	| 'labs'
	| 'quizzes'
	| 'midterm'
	| 'final_exam'
	| 'project'
	| 'research_project'
	| 'presentation'
	| 'participation'
	| 'other';

export type AssessmentComponent = {
	label: string;
	minWeight: number | null;
	maxWeight: number | null;
	exactWeight: number | null;
	category: AssessmentCategory;
	currentness: Currentness;
	term: string | null;
	sourceIds: string[];
	note: string | null;
};

export type PassingRuleType =
	| 'combined_exam_minimum'
	| 'final_exam_minimum'
	| 'overall_course_minimum'
	| 'mandatory_component'
	| 'attendance_requirement'
	| 'other';

export type PassingRequirement = {
	ruleText: string;
	ruleType: PassingRuleType;
	threshold: number | null;
	affectedCategories: AssessmentCategory[];
	currentness: Currentness;
	term: string | null;
	sourceIds: string[];
	explanation: string | null;
};
export type IdentityCandidate = {
	code: string;
	name: string;
	institution: string;
	officialDomain: string;
	sourceLabel: string;
	url: string;
	sourceId: string;
};

export type RmpProfile = {
	profileUrl: string;
	displayedName: string;
	institution: string;
	department: string | null;
	overallRating: number | null;
	ratingCount: number | null;
	wouldTakeAgainPercent: number | null;
	difficulty: number | null;
	themes: string[];
	sourceIds: string[];
};

export type StudentSentiment = {
	positives: string[];
	concerns: string[];
	sampleSize: number | null;
	courseSpecific: boolean;
	sourceIds: string[];
};

export type BriefingV4 = {
	schemaVersion: typeof BRIEFING_SCHEMA_VERSION;
	identity: {
		code: string;
		name: string;
		institution: string;
		officialDomain: string;
		catalogSourceId: string;
		candidates: IdentityCandidate[];
		confidence: 'high' | 'medium' | 'low';
		verifiedAt: string;
	};
	instructor: {
		requestedName: string | null;
		name: string | null;
		status:
			| 'requested_by_user'
			| 'verified_current_official'
			| 'supported_current_non_official'
			| 'verified_historical'
			| 'contradicted'
			| 'not_found'
			| 'not_requested';
		sourceIds: string[];
	};
	description: ReportSection;
	credits: ReportSection;
	prerequisites: ReportSection;
	corequisites: ReportSection;
	delivery: ReportSection;
	assessments: ReportSection;
	workload: ReportSection;
	rateMyProfessors: ReportSection;
	rmpProfile?: RmpProfile;
	studentSentiment?: StudentSentiment;
	contradictions: ReportSection;
	missing: ReportSection;
	summary: ReportSection;
	claims: Claim[];
	sources: EvidenceSource[];
	assessmentComponents?: AssessmentComponent[];
	passingRequirements?: PassingRequirement[];
	offerings?: {
		current?: CourseOffering;
		upcoming?: CourseOffering;
		historical?: CourseOffering[];
	};
	researchedAt: string;
	modelUsed: string;
	searchModel: string;
	synthesisModel: string;
	usage: BriefingUsage;
};

export type Briefing = BriefingV4;

const sectionSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['text', 'sourceIds', 'claimIds'],
	properties: {
		text: { type: 'string', maxLength: 3000 },
		sourceIds: { type: 'array', maxItems: 12, items: { type: 'string' } },
		claimIds: { type: 'array', maxItems: 60, items: { type: 'string' } }
	}
} as const;

export const EVIDENCE_EXTRACTION_JSON_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['sources'],
	properties: {
		sources: {
			type: 'array',
			maxItems: 10,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['title', 'url', 'excerpt'],
				properties: {
					title: { type: 'string' },
					url: { type: 'string' },
					excerpt: { type: 'string' },
					publisher: { type: ['string', 'null'] },
					publishedAt: { type: ['string', 'null'] },
					updatedAt: { type: ['string', 'null'] }
				}
			}
		}
	}
} as const;

export const BRIEFING_V4_JSON_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: [
		'identity',
		'instructor',
		'description',
		'credits',
		'prerequisites',
		'corequisites',
		'delivery',
		'assessments',
		'workload',
		'rateMyProfessors',
		'rmpProfile',
		'contradictions',
		'missing',
		'summary',
		'claims',
		'sources'
	],
	properties: {
		identity: {
			type: 'object',
			additionalProperties: false,
			required: [
				'code',
				'name',
				'institution',
				'officialDomain',
				'catalogSourceId',
				'candidates',
				'confidence',
				'verifiedAt'
			],
			properties: {
				code: { type: 'string' },
				name: { type: 'string' },
				institution: { type: 'string' },
				officialDomain: { type: 'string' },
				catalogSourceId: { type: 'string' },
				candidates: {
					type: 'array',
					maxItems: 10,
					items: {
						type: 'object',
						additionalProperties: false,
						required: [
							'code',
							'name',
							'institution',
							'officialDomain',
							'sourceLabel',
							'url',
							'sourceId'
						],
						properties: {
							code: { type: 'string' },
							name: { type: 'string' },
							institution: { type: 'string' },
							officialDomain: { type: 'string' },
							sourceLabel: { type: 'string' },
							url: { type: 'string' },
							sourceId: { type: 'string' }
						}
					}
				},
				confidence: { enum: ['high', 'medium', 'low'] },
				verifiedAt: { type: 'string' }
			}
		},
		instructor: {
			type: 'object',
			additionalProperties: false,
			required: ['requestedName', 'name', 'status', 'sourceIds'],
			properties: {
				requestedName: { type: ['string', 'null'] },
				name: { type: ['string', 'null'] },
				status: {
					enum: [
						'requested_by_user',
						'verified_current_official',
						'supported_current_non_official',
						'verified_historical',
						'contradicted',
						'not_found',
						'not_requested'
					]
				},
				sourceIds: { type: 'array', maxItems: 12, items: { type: 'string' } }
			}
		},
		description: sectionSchema,
		credits: sectionSchema,
		prerequisites: sectionSchema,
		corequisites: sectionSchema,
		delivery: sectionSchema,
		assessments: sectionSchema,
		workload: sectionSchema,
		rateMyProfessors: sectionSchema,
		rmpProfile: {
			type: 'object',
			additionalProperties: false,
			required: ['profileUrl', 'displayedName', 'institution', 'sourceIds'],
			properties: {
				profileUrl: { type: 'string' },
				displayedName: { type: 'string' },
				institution: { type: 'string' },
				department: { type: ['string', 'null'] },
				overallRating: { type: ['number', 'null'] },
				ratingCount: { type: ['integer', 'null'] },
				wouldTakeAgainPercent: { type: ['integer', 'null'] },
				difficulty: { type: ['number', 'null'] },
				themes: { type: 'array', items: { type: 'string' }, maxItems: 30 },
				sourceIds: { type: 'array', items: { type: 'string' }, maxItems: 12 }
			}
		},
		studentSentiment: {
			type: 'object',
			additionalProperties: false,
			required: ['positives', 'concerns', 'sampleSize', 'courseSpecific', 'sourceIds'],
			properties: {
				positives: { type: 'array', items: { type: 'string' }, maxItems: 30 },
				concerns: { type: 'array', items: { type: 'string' }, maxItems: 30 },
				sampleSize: { type: ['integer', 'null'] },
				courseSpecific: { type: 'boolean' },
				sourceIds: { type: 'array', items: { type: 'string' }, maxItems: 12 }
			}
		},
		contradictions: sectionSchema,
		missing: sectionSchema,
		summary: sectionSchema,
		claims: {
			type: 'array',
			maxItems: 60,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['id', 'text', 'status', 'sourceIds', 'asOf', 'explanation'],
				properties: {
					id: { type: 'string' },
					text: { type: 'string' },
					status: {
						enum: [
							'verified_current',
							'verified_historical',
							'supported_non_official',
							'inferred',
							'unknown',
							'contradicted'
						]
					},
					sourceIds: { type: 'array', maxItems: 12, items: { type: 'string' } },
					asOf: { type: ['string', 'null'] },
					explanation: { type: ['string', 'null'] }
				}
			}
		},
		sources: {
			type: 'array',
			maxItems: 35,
			items: {
				type: 'object',
				additionalProperties: false,
				required: [
					'id',
					'category',
					'title',
					'url',
					'canonicalUrl',
					'domain',
					'publisher',
					'excerpt',
					'sourceType',
					'publishedAt',
					'updatedAt',
					'retrievedAt',
					'currentness',
					'retrievalStatus',
					'contentFingerprint',
					'claimsSupported'
				],
				properties: {
					id: { type: 'string' },
					category: {
						enum: [
							'catalog',
							'prerequisites',
							'outline',
							'schedule',
							'professor-course',
							'professor-profile',
							'rate-my-professors'
						]
					},
					title: { type: 'string' },
					url: { type: 'string' },
					canonicalUrl: { type: 'string' },
					domain: { type: 'string' },
					publisher: { type: 'string' },
					excerpt: { type: 'string' },
					sourceType: { enum: ['official', 'rmp', 'other'] },
					publishedAt: { type: ['string', 'null'] },
					updatedAt: { type: ['string', 'null'] },
					retrievedAt: { type: 'string' },
					currentness: { enum: ['current', 'historical', 'unknown'] },
					retrievalStatus: { enum: ['retrieved', 'partial', 'unavailable'] },
					contentFingerprint: { type: 'string' },
					claimsSupported: { type: 'array', maxItems: 60, items: { type: 'string' } }
				}
			}
		},
		offerings: {
			type: 'object',
			properties: {
				current: {
					type: 'object',
					additionalProperties: false,
					required: ['term', 'relationship', 'sourceIds'],
					properties: {
						term: {
							type: 'object',
							additionalProperties: false,
							required: ['label'],
							properties: { id: { type: 'string' }, label: { type: 'string' } }
						},
						relationship: { const: 'current' },
						instructor: {
							type: 'object',
							additionalProperties: false,
							required: ['name', 'verification', 'sourceIds'],
							properties: {
								name: { type: 'string' },
								verification: {
									enum: ['official', 'user_confirmed', 'student_reported', 'unverified']
								},
								sourceIds: { type: 'array', maxItems: 12, items: { type: 'string' } }
							}
						},
						crn: { type: 'string' },
						section: { type: 'string' },
						campus: { type: 'string' },
						modality: { type: 'string' },
						schedule: { type: 'string' },
						sourceIds: { type: 'array', maxItems: 12, items: { type: 'string' } }
					}
				},
				upcoming: {
					type: 'object',
					additionalProperties: false,
					required: ['term', 'relationship', 'sourceIds'],
					properties: {
						term: {
							type: 'object',
							additionalProperties: false,
							required: ['label'],
							properties: { id: { type: 'string' }, label: { type: 'string' } }
						},
						relationship: { const: 'upcoming' },
						instructor: {
							type: 'object',
							additionalProperties: false,
							required: ['name', 'verification', 'sourceIds'],
							properties: {
								name: { type: 'string' },
								verification: {
									enum: ['official', 'user_confirmed', 'student_reported', 'unverified']
								},
								sourceIds: { type: 'array', maxItems: 12, items: { type: 'string' } }
							}
						},
						crn: { type: 'string' },
						section: { type: 'string' },
						campus: { type: 'string' },
						modality: { type: 'string' },
						schedule: { type: 'string' },
						sourceIds: { type: 'array', maxItems: 12, items: { type: 'string' } }
					}
				}
			}
		}
	}
} as const;

const { sources: _synthesisSources, ...synthesisProperties } = BRIEFING_V4_JSON_SCHEMA.properties;

export const SYNTHESIS_ONLY_JSON_SCHEMA = {
	...BRIEFING_V4_JSON_SCHEMA,
	required: BRIEFING_V4_JSON_SCHEMA.required.filter((field) => field !== 'sources'),
	properties: synthesisProperties
} as const;

export const BRIEFING_V3_JSON_SCHEMA = BRIEFING_V4_JSON_SCHEMA;
export type BriefingV3 = BriefingV4;
export const BRIEFING_JSON_SCHEMA = BRIEFING_V4_JSON_SCHEMA;
