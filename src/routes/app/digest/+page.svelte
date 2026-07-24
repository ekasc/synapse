<script lang="ts">
	import { resolve } from '$app/paths';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import { Dialog } from '$lib/components/ui';

	type GradeItem = {
		id: string;
		category: string;
		label: string;
		score: number;
		max: number;
		source: 'manual' | 'syllabus';
	};

	type WeightItem = {
		category: string;
		weight: number;
		source: string;
	};

	type CourseDigest = {
		id: string;
		semesterId?: string;
		code: string;
		name: string;
		term: string;
		instructor: string;
		credits: number;
		courseHref: string;
		syllabusHref: string;
		weights: WeightItem[];
		initialGrades: GradeItem[];
		transcript: {
			currentPercent: number;
			projectedPercent: number;
		};
	};

	type TranscriptCourse = {
		id: string;
		code: string;
		name: string;
		term: string;
		credits: number;
		currentPercent: number;
		projectedPercent: number;
		status: 'current' | 'finished';
		letter: string;
		historyGrades?: Array<{
			label: string;
			category: string;
			score: number;
			max: number;
		}>;
	};

	type SetupCourse = {
		id: string;
		semesterId: string;
		code: string;
		name: string;
		instructor?: string;
		credits?: number;
		signals?: {
			currentGrade?: number;
			projectedGrade?: number;
		};
	};

	type SetupSemester = {
		id: string;
		term: string;
		year: number;
		order: number;
	};

	type AcademicDigest = {
		id: string;
		source: 'sample' | 'setup-import' | 'transcript-upload';
		fileName?: string;
		summary: string;
		totalGpa: number;
		projectedGpa: number;
		currentCourseCount: number;
		finishedCourseCount: number;
		currentCredits: number;
		finishedCredits: number;
		courses: TranscriptCourse[];
		trend: Array<{
			label: string;
			term: string;
			gpa: number;
			credits: number;
			note: string;
		}>;
		insights: string[];
		extractionSource: 'openrouter' | 'fallback';
		updatedAt: string;
	};

	type GpaScale = 'douglas-4.33' | 'standard-4.0';

	let {
		data
	}: { data: { courses: SetupCourse[]; digest: AcademicDigest; semesters: SetupSemester[] } } =
		$props();

	const defaultWeights: WeightItem[] = [
		{ category: 'Assignments', weight: 30, source: 'course import' },
		{ category: 'Projects', weight: 25, source: 'course import' },
		{ category: 'Participation', weight: 10, source: 'course import' },
		{ category: 'Final', weight: 35, source: 'course import' }
	];

	const emptyCourse: CourseDigest = {
		id: '',
		code: 'No course',
		name: 'No course selected',
		term: '',
		instructor: '',
		credits: 0,
		courseHref: '/app/semesters',
		syllabusHref: '/app/syllabus',
		weights: [],
		initialGrades: [],
		transcript: {
			currentPercent: 0,
			projectedPercent: 0
		}
	};

	const finishedCourses: TranscriptCourse[] = [
		{
			id: 'hist-csis-2270',
			code: 'CSIS 2270',
			name: 'Database Systems',
			term: 'Spring 2026',
			credits: 3,
			currentPercent: 94,
			projectedPercent: 94,
			status: 'finished',
			letter: 'A',
			historyGrades: [
				{ label: 'SQL design project', category: 'Project', score: 97, max: 100 },
				{ label: 'Midterm exam', category: 'Exam', score: 91, max: 100 },
				{ label: 'Normalization quiz set', category: 'Quiz', score: 28, max: 30 }
			]
		},
		{
			id: 'hist-math-1113',
			code: 'MATH 1113',
			name: 'Precalculus',
			term: 'Spring 2026',
			credits: 3,
			currentPercent: 88,
			projectedPercent: 88,
			status: 'finished',
			letter: 'B+',
			historyGrades: [
				{ label: 'Functions unit test', category: 'Exam', score: 86, max: 100 },
				{ label: 'Trigonometry homework', category: 'Homework', score: 94, max: 100 },
				{ label: 'Final review quiz', category: 'Quiz', score: 17, max: 20 }
			]
		},
		{
			id: 'hist-comm-1100',
			code: 'COMM 1100',
			name: 'Human Communication',
			term: 'Fall 2025',
			credits: 3,
			currentPercent: 91,
			projectedPercent: 91,
			status: 'finished',
			letter: 'A-',
			historyGrades: [
				{ label: 'Persuasive speech', category: 'Presentation', score: 46, max: 50 },
				{ label: 'Group facilitation', category: 'Participation', score: 19, max: 20 },
				{ label: 'Reflection portfolio', category: 'Writing', score: 90, max: 100 }
			]
		},
		{
			id: 'hist-csis-1200',
			code: 'CSIS 1200',
			name: 'Introduction to Programming',
			term: 'Fall 2024',
			credits: 3,
			currentPercent: 89,
			projectedPercent: 89,
			status: 'finished',
			letter: 'B+',
			historyGrades: [
				{ label: 'Python basics lab', category: 'Lab', score: 45, max: 50 },
				{ label: 'Control flow exam', category: 'Exam', score: 86, max: 100 },
				{ label: 'Final project', category: 'Project', score: 92, max: 100 }
			]
		},
		{
			id: 'hist-engl-1101',
			code: 'ENGL 1101',
			name: 'Composition I',
			term: 'Fall 2024',
			credits: 3,
			currentPercent: 93,
			projectedPercent: 93,
			status: 'finished',
			letter: 'A',
			historyGrades: [
				{ label: 'Narrative essay', category: 'Essay', score: 95, max: 100 },
				{ label: 'Research draft', category: 'Writing', score: 46, max: 50 },
				{ label: 'Final portfolio', category: 'Portfolio', score: 92, max: 100 }
			]
		},
		{
			id: 'hist-math-1111',
			code: 'MATH 1111',
			name: 'College Algebra',
			term: 'Spring 2025',
			credits: 3,
			currentPercent: 85,
			projectedPercent: 85,
			status: 'finished',
			letter: 'B',
			historyGrades: [
				{ label: 'Polynomial test', category: 'Exam', score: 82, max: 100 },
				{ label: 'Systems homework', category: 'Homework', score: 44, max: 50 },
				{ label: 'Final exam', category: 'Exam', score: 86, max: 100 }
			]
		},
		{
			id: 'hist-psyc-1101',
			code: 'PSYC 1101',
			name: 'General Psychology',
			term: 'Spring 2025',
			credits: 3,
			currentPercent: 90,
			projectedPercent: 90,
			status: 'finished',
			letter: 'A-',
			historyGrades: [
				{ label: 'Memory unit quiz', category: 'Quiz', score: 18, max: 20 },
				{ label: 'Research summary', category: 'Writing', score: 45, max: 50 },
				{ label: 'Cumulative exam', category: 'Exam', score: 88, max: 100 }
			]
		},
		{
			id: 'hist-csis-2300',
			code: 'CSIS 2300',
			name: 'Data Structures',
			term: 'Fall 2025',
			credits: 3,
			currentPercent: 87,
			projectedPercent: 87,
			status: 'finished',
			letter: 'B+',
			historyGrades: [
				{ label: 'Linked list lab', category: 'Lab', score: 28, max: 30 },
				{ label: 'Trees exam', category: 'Exam', score: 84, max: 100 },
				{ label: 'Algorithm project', category: 'Project', score: 90, max: 100 }
			]
		},
		{
			id: 'hist-stat-1401',
			code: 'STAT 1401',
			name: 'Elementary Statistics',
			term: 'Fall 2025',
			credits: 3,
			currentPercent: 92,
			projectedPercent: 92,
			status: 'finished',
			letter: 'A-',
			historyGrades: [
				{ label: 'Probability quiz', category: 'Quiz', score: 19, max: 20 },
				{ label: 'Regression lab', category: 'Lab', score: 47, max: 50 },
				{ label: 'Final exam', category: 'Exam', score: 90, max: 100 }
			]
		},
		{
			id: 'hist-csis-3270',
			code: 'CSIS 3270',
			name: 'Systems Analysis',
			term: 'Spring 2026',
			credits: 3,
			currentPercent: 88,
			projectedPercent: 88,
			status: 'finished',
			letter: 'B+',
			historyGrades: [
				{ label: 'Requirements brief', category: 'Writing', score: 43, max: 50 },
				{ label: 'UML model set', category: 'Project', score: 91, max: 100 },
				{ label: 'Case study exam', category: 'Exam', score: 86, max: 100 }
			]
		}
	];

	let selectedCourseId = $state('');
	let selectedCategory = $state('');
	let gradeItemsByCourse = $state<Record<string, GradeItem[]>>({});
	let gradeLabel = $state('');
	let gradeScore = $state('');
	let gradeMax = $state('100');
	let targetGrade = $state(85);
	let targetGpa = $state(3.5);
	let gpaScale = $state<GpaScale>('douglas-4.33');
	let activeDigestTab = $state<'gpa' | 'term'>('gpa');
	let selectedPerformanceTerm = $state('');
	let performanceTermTouched = $state(false);
	let selectedHistoryCourseId = $state<string | null>(null);
	let backendDigest = $state<AcademicDigest | null>(null);
	let transcriptUploading = $state(false);
	let digestResetting = $state(false);
	let transcriptUploadError = $state('');

	const importedCourseDigests = $derived.by(() =>
		data.courses.map((course, index) => {
			const semester = data.semesters.find((item) => item.id === course.semesterId);
			const currentPercent = course.signals?.currentGrade ?? 86 + (index % 5);
			const projectedPercent = course.signals?.projectedGrade ?? Math.min(96, currentPercent + 1);

			return {
				id: course.id,
				code: course.code,
				name: course.name,
				term: semester ? `${semester.term} ${semester.year}` : 'Imported term',
				instructor: course.instructor ?? 'Instructor TBD',
				credits: course.credits ?? 3,
				semesterId: course.semesterId,
				courseHref: resolve('/app/semesters/[semesterId]/courses/[courseId]', {
					semesterId: course.semesterId,
					courseId: course.id
				}),
				syllabusHref: resolve('/app/semesters/[semesterId]/courses/[courseId]/syllabus', {
					semesterId: course.semesterId,
					courseId: course.id
				}),
				weights: defaultWeights,
				initialGrades: [],
				transcript: {
					currentPercent,
					projectedPercent
				}
			};
		})
	);

	const courses = $derived(importedCourseDigests);
	const hasSetupCourseImport = $derived(importedCourseDigests.length > 0);
	const activeBackendDigest = $derived(backendDigest ?? data.digest);
	const digestInsight = $derived(
		activeBackendDigest.insights?.[0] &&
			activeBackendDigest.insights[0] !== activeBackendDigest.summary
			? activeBackendDigest.insights[0]
			: ''
	);
	const transcriptSourceLabel = $derived(
		activeBackendDigest.fileName
			? activeBackendDigest.fileName
			: activeBackendDigest.source === 'setup-import' || hasSetupCourseImport
				? 'Setup course import'
				: 'No transcript imported'
	);
	const digestSourceBadge = $derived(
		activeBackendDigest.source === 'transcript-upload'
			? activeBackendDigest.extractionSource === 'openrouter'
				? 'AI analytics'
				: 'fallback analytics'
			: hasSetupCourseImport
				? `${importedCourseDigests.length} setup courses`
				: 'empty'
	);
	const backendPerformanceTrend = $derived(activeBackendDigest.trend ?? []);
	const latestPerformanceTerm = $derived(
		backendPerformanceTrend[backendPerformanceTrend.length - 1]?.term ?? ''
	);

	const activeCourse = $derived(
		courses.find((course) => course.id === selectedCourseId) ?? courses[0] ?? emptyCourse
	);
	const syllabusWeights = $derived(activeCourse.weights);
	const gradeItems = $derived(gradeItemsByCourse[selectedCourseId] ?? []);
	const hasGradeEntries = $derived(gradeItems.length > 0);
	const weightsByCategory = $derived.by(() => {
		const weights: Record<string, number> = {};
		for (const item of syllabusWeights) weights[item.category] = item.weight;
		return weights;
	});

	const categoryAnalytics = $derived.by(() =>
		syllabusWeights.map((weight) => {
			const items = gradeItems.filter((item) => item.category === weight.category);
			const earned = items.reduce((sum, item) => sum + item.score, 0);
			const possible = items.reduce((sum, item) => sum + item.max, 0);
			const average = possible > 0 ? (earned / possible) * 100 : null;
			const contribution = average === null ? 0 : (average * weight.weight) / 100;

			return {
				...weight,
				items,
				average,
				contribution,
				status:
					average === null
						? 'waiting'
						: average >= 85
							? 'strong'
							: average >= 70
								? 'steady'
								: 'review'
			};
		})
	);

	const completedWeight = $derived(
		categoryAnalytics.reduce((sum, item) => sum + (item.average === null ? 0 : item.weight), 0)
	);
	const currentContribution = $derived(
		categoryAnalytics.reduce((sum, item) => sum + item.contribution, 0)
	);
	const currentAverage = $derived(
		completedWeight > 0 ? (currentContribution / completedWeight) * 100 : 0
	);
	const unresolvedProjectionContribution = $derived.by(() =>
		categoryAnalytics.reduce((sum, item) => {
			if (item.average !== null) return sum;
			return sum + (targetGrade * item.weight) / 100;
		}, 0)
	);
	const projectedFinal = $derived(currentContribution + unresolvedProjectionContribution);
	const courseProjectionDelta = $derived(projectedFinal - currentAverage);
	const courseProjectionDirection = $derived(
		courseProjectionDelta > 0 ? 'up' : courseProjectionDelta < 0 ? 'down' : 'same'
	);
	const finalCategory = $derived(categoryAnalytics.find((item) => item.category === 'Final'));
	const finalNeeded = $derived.by(() => {
		if (!hasGradeEntries) return 0;
		const finalWeight = weightsByCategory.Final ?? 0;
		if (finalWeight === 0) return 0;
		const nonFinalContribution = categoryAnalytics
			.filter((item) => item.category !== 'Final')
			.reduce((sum, item) => sum + item.contribution, 0);
		return Math.max(0, Math.min(100, ((targetGrade - nonFinalContribution) / finalWeight) * 100));
	});

	const currentTranscriptCourses = $derived.by(() =>
		courses.map((course) => {
			if (course.id !== selectedCourseId) {
				return {
					...course,
					currentPercent: course.transcript.currentPercent,
					projectedPercent: course.transcript.projectedPercent,
					status: 'current' as const,
					letter: percentToLetter(course.transcript.projectedPercent)
				};
			}

			return {
				...course,
				currentPercent: currentAverage,
				projectedPercent: projectedFinal,
				status: 'current' as const,
				letter: percentToLetter(projectedFinal)
			};
		})
	);
	const transcriptCourses = $derived([...currentTranscriptCourses, ...finishedCourses]);
	const backendTranscriptCourses = $derived(activeBackendDigest.courses ?? []);
	const dashboardCurrentTranscriptCourses = $derived(
		backendTranscriptCourses.filter((course) => course.status === 'current')
	);
	const dashboardFinishedCourses = $derived(
		backendTranscriptCourses.filter((course) => course.status === 'finished')
	);
	const dashboardTranscriptCourses = $derived([
		...dashboardCurrentTranscriptCourses,
		...dashboardFinishedCourses
	]);
	const hasAcademicProgressData = $derived(dashboardTranscriptCourses.length > 0);
	const projectedGpa = $derived(weightedGpa(transcriptCourses, 'projectedPercent'));
	const gpaScaleMaximum = $derived(gpaScale === 'douglas-4.33' ? 4.33 : 4);
	const calculatedDashboardTotalGpa = $derived(
		weightedGpa(dashboardTranscriptCourses, 'currentPercent')
	);
	const dashboardTotalGpa = $derived(
		gpaScale === 'douglas-4.33' && activeBackendDigest.source === 'transcript-upload'
			? activeBackendDigest.totalGpa
			: calculatedDashboardTotalGpa
	);
	const dashboardProjectedGpa = $derived(
		weightedGpa(dashboardTranscriptCourses, 'projectedPercent')
	);
	const performanceTrendSource = $derived.by(() => {
		let cumulativeCourses: TranscriptCourse[] = [];
		return backendPerformanceTrend.map((item, index) => {
			cumulativeCourses = [
				...cumulativeCourses,
				...dashboardTranscriptCourses.filter((course) => course.term === item.term)
			];
			const isLatest = index === backendPerformanceTrend.length - 1;
			return {
				...item,
				gpa:
					isLatest && gpaScale === 'douglas-4.33'
						? dashboardTotalGpa
						: weightedGpa(cumulativeCourses, 'currentPercent')
			};
		});
	});
	const currentGpaBeforeSelectedProjection = $derived.by(() => {
		const baselineCourses = transcriptCourses.map((course) =>
			course.id === selectedCourseId
				? {
						...course,
						currentPercent: currentAverage,
						projectedPercent: currentAverage
					}
				: course
		);

		return weightedGpa(baselineCourses, 'projectedPercent');
	});
	const projectedGpaDelta = $derived(projectedGpa - currentGpaBeforeSelectedProjection);
	const projectedGpaDirection = $derived(
		projectedGpaDelta > 0 ? 'up' : projectedGpaDelta < 0 ? 'down' : 'same'
	);
	const targetGpaDelta = $derived(targetGpa - projectedGpa);
	const selectedHistoryCourse = $derived(
		dashboardFinishedCourses.find((course) => course.id === selectedHistoryCourseId) ?? null
	);
	const selectedHistoryHasDetailedGrades = $derived(
		Boolean(selectedHistoryCourse?.historyGrades?.length)
	);
	const performanceTermOptions = $derived(
		Array.from(new Set(dashboardTranscriptCourses.map((course) => course.term)))
	);
	const selectedTermCourses = $derived(
		dashboardTranscriptCourses.filter((course) => course.term === selectedPerformanceTerm)
	);
	const performanceTrendWithDelta = $derived(
		performanceTrendSource.map((item, index) => {
			const previousGpa = performanceTrendSource[index - 1]?.gpa ?? item.gpa;
			const delta = item.gpa - previousGpa;
			return {
				...item,
				delta,
				direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
				marker: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
				signedDelta: `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`
			};
		})
	);
	const firstYearGpa = $derived(performanceTrendSource[0]?.gpa ?? 0);
	const latestGpa = $derived(performanceTrendSource[performanceTrendSource.length - 1]?.gpa ?? 0);
	const performanceDelta = $derived(latestGpa - firstYearGpa);

	$effect(() => {
		if (courses.some((course) => course.id === selectedCourseId)) return;
		selectedCourseId = courses[0]?.id ?? '';
		selectedCategory = courses[0]?.weights[0]?.category ?? '';
	});

	$effect(() => {
		if (!latestPerformanceTerm) return;
		if (performanceTermTouched && performanceTermOptions.includes(selectedPerformanceTerm)) return;
		selectedPerformanceTerm = latestPerformanceTerm;
	});

	$effect(() => {
		if (targetGpa > gpaScaleMaximum) targetGpa = gpaScaleMaximum;
	});

	function changeCourse(event: Event) {
		const nextCourseId = (event.currentTarget as HTMLSelectElement).value;
		const nextCourse = courses.find((course) => course.id === nextCourseId) ?? courses[0];
		selectedCourseId = nextCourse.id;
		selectedCategory = nextCourse.weights[0]?.category ?? '';
	}

	function changePerformanceTerm(event: Event) {
		selectedPerformanceTerm = (event.currentTarget as HTMLSelectElement).value;
		performanceTermTouched = true;
	}

	function updateGradeItems(items: GradeItem[]) {
		gradeItemsByCourse = {
			...gradeItemsByCourse,
			[selectedCourseId]: items
		};
	}

	function letterToGpa(letter: string) {
		const standard: Record<string, number> = {
			'A+': 4,
			A: 4,
			'A-': 3.7,
			'B+': 3.3,
			B: 3,
			'B-': 2.7,
			'C+': 2.3,
			C: 2,
			'C-': 1.7,
			'D+': 1.3,
			D: 1,
			F: 0
		};
		const douglas: Record<string, number> = {
			...standard,
			'A+': 4.33,
			'A-': 3.67,
			'B+': 3.33,
			'B-': 2.67,
			'C+': 2.33,
			'C-': 1.67,
			'D+': 1.33
		};
		return (gpaScale === 'douglas-4.33' ? douglas : standard)[letter.toUpperCase()] ?? null;
	}

	function percentToGpa(percent: number) {
		return letterToGpa(percentToLetter(percent)) ?? 0;
	}

	function percentToLetter(percent: number) {
		if (percent >= 97) return 'A+';
		if (percent >= 93) return 'A';
		if (percent >= 90) return 'A-';
		if (percent >= 87) return 'B+';
		if (percent >= 83) return 'B';
		if (percent >= 80) return 'B-';
		if (percent >= 77) return 'C+';
		if (percent >= 73) return 'C';
		if (percent >= 70) return 'C-';
		if (percent >= 67) return 'D+';
		if (percent >= 60) return 'D';
		return 'F';
	}

	function weightedGpa(
		items: Array<{
			credits: number;
			currentPercent: number;
			projectedPercent: number;
			status?: 'current' | 'finished';
			letter?: string;
		}>,
		key: 'currentPercent' | 'projectedPercent'
	) {
		const gradedItems = items.flatMap((item) => {
			const gradePoints =
				item.status === 'finished' && item.letter
					? letterToGpa(item.letter)
					: percentToGpa(item[key]);
			return gradePoints === null ? [] : [{ ...item, gradePoints }];
		});
		const credits = gradedItems.reduce((sum, item) => sum + item.credits, 0);
		if (credits === 0) return 0;
		const points = gradedItems.reduce((sum, item) => sum + item.gradePoints * item.credits, 0);
		return points / credits;
	}

	function addGrade() {
		const score = Number(gradeScore);
		const max = Number(gradeMax);
		if (!gradeLabel.trim() || !Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return;

		updateGradeItems([
			...gradeItems,
			{
				id: crypto.randomUUID(),
				category: selectedCategory,
				label: gradeLabel.trim(),
				score,
				max,
				source: 'manual'
			}
		]);
		gradeLabel = '';
		gradeScore = '';
		gradeMax = '100';
	}

	function importSampleGrades() {
		const sampleCategory = syllabusWeights.find((item) => item.category !== 'Final')?.category;
		if (!sampleCategory) return;

		updateGradeItems([
			...gradeItems,
			{
				id: crypto.randomUUID(),
				category: sampleCategory,
				label: `${sampleCategory} sample`,
				score: 90,
				max: 100,
				source: 'manual'
			}
		]);
	}

	async function importTranscriptFile(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		transcriptUploading = true;
		transcriptUploadError = '';
		try {
			const form = new FormData();
			form.append('transcript', file);
			const response = await fetch('/api/digest/transcript', {
				method: 'POST',
				body: form
			});
			const result = (await response.json().catch(() => ({
				ok: false,
				error: `Transcript upload failed with status ${response.status}.`
			}))) as {
				ok?: boolean;
				job?: {
					id: string;
					fileName: string;
					status: 'queued' | 'processing' | 'completed' | 'failed';
					error: string | null;
				};
				error?: string;
			};
			if (!response.ok || !result.ok || !result.job) {
				throw new Error(result.error ?? 'Could not digest transcript');
			}
			window.dispatchEvent(new CustomEvent('academic-digest-job-started', { detail: result.job }));
			activeDigestTab = 'gpa';
		} catch (error) {
			transcriptUploadError =
				error instanceof Error ? error.message : 'Could not digest transcript';
		} finally {
			transcriptUploading = false;
			(event.currentTarget as HTMLInputElement).value = '';
		}
	}

	async function resetAcademicDigest() {
		digestResetting = true;
		transcriptUploadError = '';
		try {
			const response = await fetch('/api/digest', { method: 'DELETE' });
			const result = (await response.json()) as {
				ok?: boolean;
				digest?: AcademicDigest;
				error?: string;
			};
			if (!response.ok || !result.ok || !result.digest) {
				throw new Error(result.error ?? 'Could not reset academic progress import');
			}
			const resetDigest: AcademicDigest = {
				...result.digest,
				courses: Array.isArray(result.digest.courses) ? result.digest.courses : [],
				trend: Array.isArray(result.digest.trend) ? result.digest.trend : [],
				insights: Array.isArray(result.digest.insights) ? result.digest.insights : []
			};
			backendDigest = resetDigest;
			performanceTermTouched = false;
			selectedPerformanceTerm = resetDigest.trend.at(-1)?.term ?? '';
			selectedHistoryCourseId = null;
			activeDigestTab = 'gpa';
		} catch (error) {
			transcriptUploadError =
				error instanceof Error ? error.message : 'Could not reset academic progress import';
		} finally {
			digestResetting = false;
		}
	}

	function removeGrade(id: string) {
		updateGradeItems(gradeItems.filter((item) => item.id !== id));
	}

	function openHistoryCourse(id: string) {
		selectedHistoryCourseId = id;
	}

	function closeHistoryCourse() {
		selectedHistoryCourseId = null;
	}
</script>

<svelte:head><title>Digest · Synapse</title></svelte:head>

<div class="page page-enter">
	<div class="page-cover">
		<div class="page-cover-row">
			<div>
				<div class="page-cover-stamps">
					<span class="stamp-sm stamp-rot-l">from syllabus</span>
					<span class="stamp-sm stamp-rot-r">grade analytics</span>
				</div>
				<h1 class="page-title">Digest</h1>
				<p class="page-tagline">
					Grade weights are pulled from the Syllabus Intelligence extraction. Add your scores here
					to project where the course is heading.
				</p>
			</div>
		</div>
	</div>

	<div class="digest-tabs" aria-label="Digest views">
		<button
			type="button"
			class:active={activeDigestTab === 'gpa'}
			aria-pressed={activeDigestTab === 'gpa'}
			onclick={() => (activeDigestTab = 'gpa')}
		>
			<span class="font-mono">Total GPA</span>
			<strong>Academic Progress Overview</strong>
		</button>
		<button
			type="button"
			class:active={activeDigestTab === 'term'}
			aria-pressed={activeDigestTab === 'term'}
			onclick={() => (activeDigestTab = 'term')}
		>
			<span class="font-mono">Current Course</span>
			<strong>Term Grade Dashboard</strong>
		</button>
	</div>

	{#if activeDigestTab === 'gpa'}
		<section class="surface gpa-panel" aria-label="Total GPA projection">
			<div class="gpa-hero">
				<div>
					<span class="gpa-kicker font-mono">GPA analytics + projection</span>
					<h2 class="gpa-title">Total GPA</h2>
					<p class="gpa-copy">
						{hasSetupCourseImport
							? 'Courses imported during setup are digested into this academic progress view.'
							: 'Completed history and current courses stay together in one transcript view.'}
					</p>
				</div>
				<div class="transcript-upload-actions">
					<label class="gpa-scale-control">
						<span class="font-mono">GPA scale</span>
						<select bind:value={gpaScale} aria-label="GPA scale">
							<option value="douglas-4.33">Douglas 4.33</option>
							<option value="standard-4.0">Standard 4.0</option>
						</select>
					</label>
					<label class="btn btn-primary upload-transcript">
						<input
							type="file"
							accept=".pdf,.csv,.txt,.jpg,.jpeg,.png,image/*"
							aria-label="Upload transcript for academic progress"
							disabled={transcriptUploading || digestResetting}
							onchange={importTranscriptFile}
						/>
						{transcriptUploading ? 'digesting transcript' : 'upload transcript'}
					</label>
					<button
						type="button"
						class="btn btn-secondary"
						disabled={transcriptUploading || digestResetting || !hasAcademicProgressData}
						onclick={resetAcademicDigest}
					>
						{digestResetting ? 'resetting' : 'reset import'}
					</button>
					<span class="source-note font-mono">Source: {transcriptSourceLabel}</span>
				</div>
				{#if transcriptUploadError}
					<p class="upload-error font-mono">{transcriptUploadError}</p>
				{/if}
			</div>

			<dl class="gpa-facts">
				<div>
					<dt>Total GPA ({gpaScale === 'douglas-4.33' ? '4.33' : '4.0'} scale)</dt>
					<dd>{hasAcademicProgressData ? dashboardTotalGpa.toFixed(2) : '--'}</dd>
				</div>
				<div>
					<dt>Trend</dt>
					<dd
						class={hasAcademicProgressData
							? performanceDelta > 0
								? 'up'
								: performanceDelta < 0
									? 'down'
									: 'same'
							: ''}
					>
						{#if hasAcademicProgressData}
							<span
								class={`trend-icon ${performanceDelta > 0 ? 'up' : performanceDelta < 0 ? 'down' : 'same'}`}
								aria-hidden="true"
							></span>
							{performanceDelta >= 0 ? '+' : ''}{performanceDelta.toFixed(2)}
						{:else}
							--
						{/if}
					</dd>
				</div>
				<div>
					<dt>Credits</dt>
					<dd>
						{activeBackendDigest.currentCredits + activeBackendDigest.finishedCredits} tracked
						<span>· {activeBackendDigest.currentCredits} in progress</span>
						<span>· {activeBackendDigest.finishedCredits} from history</span>
					</dd>
				</div>
			</dl>

			<div class="digest-source-strip">
				<div>
					<span class="index-label">Academic history digest</span>
					<strong>{activeBackendDigest.summary}</strong>
					{#if digestInsight}
						<span class="source-note">{digestInsight}</span>
					{/if}
				</div>
				<span class="import-badge font-mono">{digestSourceBadge}</span>
			</div>

			<div class="transcript-columns" role="group" aria-label="Courses included in GPA">
				<div class="transcript-column current-column">
					<div class="transcript-column-head">
						<span class="font-mono">Current courses</span>
						<strong>{dashboardCurrentTranscriptCourses.length}</strong>
					</div>
					<div class="transcript-list" role="list">
						{#if dashboardCurrentTranscriptCourses.length > 0}
							{#each dashboardCurrentTranscriptCourses as course (course.id)}
								<div
									class:active={course.id === selectedCourseId}
									class="gpa-course-row current"
									role="listitem"
								>
									<span class="font-mono">{course.code}</span>
									<span>{course.term}</span>
									<span>{percentToGpa(course.currentPercent).toFixed(2)} GPA</span>
								</div>
							{/each}
						{:else}
							<p class="empty-gradebook-note">No current courses have been imported.</p>
						{/if}
					</div>
				</div>

				<div class="transcript-column finished-column">
					<div class="transcript-column-head">
						<span class="font-mono">Finished courses</span>
						<strong>{dashboardFinishedCourses.length}</strong>
					</div>
					<div class="transcript-list">
						{#if dashboardFinishedCourses.length > 0}
							{#each dashboardFinishedCourses as course (course.id)}
								<button
									type="button"
									class="gpa-course-row finished history-trigger"
									aria-label={`Open ${course.code} grade history`}
									onclick={() => openHistoryCourse(course.id)}
								>
									<span class="font-mono">{course.code}</span>
									<span>{course.term}</span>
									<span>
										{course.letter} - {course.currentPercent.toFixed(0)}% -
										{letterToGpa(course.letter)?.toFixed(2) ?? '--'} GPA
									</span>
									<span class="history-open-label font-mono">
										{course.historyGrades?.length ? 'open gradebook' : 'view transcript note'}
									</span>
								</button>
							{/each}
						{:else}
							<p class="empty-gradebook-note">No finished course history has been imported.</p>
						{/if}
					</div>
				</div>
			</div>
		</section>

		{#if hasAcademicProgressData}
			<section class="surface performance-panel" aria-label="Performance over time">
				<div class="performance-head">
					<div>
						<span class="gpa-kicker font-mono">Academic performance analytics</span>
						<h2>GPA Trend by Academic Term</h2>
					</div>
					<div class="performance-delta">
						<span class="index-label">GPA movement</span>
						<strong class={performanceDelta >= 0 ? 'ok' : 'warn'}>
							{performanceDelta >= 0 ? '+' : ''}{performanceDelta.toFixed(2)}
						</strong>
					</div>
				</div>

				<div class="performance-body">
					<div class="performance-chart" role="img" aria-label="GPA trend bar chart">
						{#each performanceTrendWithDelta as item (item.term)}
							<div class="term-bar">
								<div class="term-bar-track">
									<span class={item.direction} style="height: {(item.gpa / gpaScaleMaximum) * 100}%"
									></span>
								</div>
								<strong class={`trend-value ${item.direction}`}>
									{item.gpa.toFixed(2)}
								</strong>
								<span class={`trend-icon ${item.direction}`} aria-label={`GPA ${item.direction}`}
								></span>
								<small class="font-mono">{item.label}</small>
							</div>
						{/each}
					</div>

					<div class="performance-list">
						{#each performanceTrendWithDelta as item (item.term)}
							<div class="performance-row">
								<span class="font-mono">{item.label}</span>
								<span>{item.term}</span>
								<strong class={`trend-value ${item.direction}`}>
									{item.gpa.toFixed(2)}
									<span class="trend-change" aria-label={`GPA ${item.direction}`}>
										<span class={`trend-icon ${item.direction}`}></span>
										{item.signedDelta}
									</span>
								</strong>
								<span>{item.note}</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="term-performance-panel">
					<div class="term-performance-head">
						<div>
							<span class="gpa-kicker font-mono">Course performance by term</span>
							<h3>{selectedPerformanceTerm} Course Results</h3>
						</div>
						<label class="term-select-box">
							<span class="field-label font-mono">Choose term</span>
							<div class="select-shell">
								<select value={selectedPerformanceTerm} onchange={changePerformanceTerm}>
									{#each performanceTermOptions as term (term)}
										<option value={term}>{term}</option>
									{/each}
								</select>
								<span class="dropdown-arrow" aria-hidden="true">v</span>
							</div>
						</label>
					</div>

					<div
						class="term-course-chart"
						role="img"
						aria-label={`Course performance for ${selectedPerformanceTerm}`}
					>
						{#each selectedTermCourses as course (course.id)}
							<div class="term-course-bar">
								<div>
									<span class="font-mono">{course.code}</span>
									<strong>
										{course.status === 'finished' ? course.letter : 'In progress'} -
										{course.status === 'finished'
											? (letterToGpa(course.letter)?.toFixed(2) ?? '--')
											: percentToGpa(course.currentPercent).toFixed(2)} GPA
									</strong>
								</div>
								<div class="course-bar-track">
									<span style="width: {Math.min(100, course.currentPercent)}%"></span>
								</div>
								<small>{course.currentPercent.toFixed(0)}%</small>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{:else}
			<section class="surface performance-panel" aria-label="Performance over time">
				<div class="performance-head">
					<div>
						<span class="gpa-kicker font-mono">Academic performance analytics</span>
						<h2>No GPA trend yet</h2>
						<p class="empty-gradebook-note">
							Upload a transcript or import setup courses to generate academic progress analytics.
						</p>
					</div>
				</div>
			</section>
		{/if}
	{:else}
		<div class="course-dashboard-heading">
			<span class="gpa-kicker font-mono">Course grade dashboard</span>
			<h2 class="gpa-title">Current Term Dashboard</h2>
			<p>Choose a course to view its grade analytics, projection, and import tools.</p>
		</div>

		{#if courses.length === 0}
			<section class="surface empty-course-state" aria-label="No courses available">
				<span class="gpa-kicker font-mono">No courses imported</span>
				<h2>No course dashboard yet</h2>
				<p>
					Import courses during setup or upload a syllabus before course-specific grade analytics
					are shown here.
				</p>
			</section>
		{:else}
			<section class="surface course-link" aria-label="Course dashboard selector">
				<div class="course-link-main">
					<div>
						<span class="course-link-label font-mono">Course dashboard selector</span>
						<h2 class="course-link-title">
							<span class="course-code font-mono">{activeCourse.code}</span>
							{activeCourse.name}
						</h2>
					</div>
					<div class="course-link-meta">
						<span>{activeCourse.term}</span>
						<span>{activeCourse.instructor}</span>
						<span>Syllabus Intelligence - grading scheme</span>
					</div>
				</div>

				<div class="course-select-box">
					<label class="field-label font-mono" for="course-select">Switch course</label>
					<div class="select-shell">
						<select id="course-select" value={selectedCourseId} onchange={changeCourse}>
							{#each courses as course (course.id)}
								<option value={course.id}>{course.code} - {course.name}</option>
							{/each}
						</select>
						<span class="dropdown-arrow" aria-hidden="true">v</span>
					</div>
					<div class="course-link-actions">
						<!-- eslint-disable svelte/no-navigation-without-resolve -- Course hrefs are assembled from imported route data. -->
						<a class="btn btn-primary" href={activeCourse.courseHref}>open course</a>
						<a class="btn btn-secondary" href={activeCourse.syllabusHref}>view syllabus</a>
					</div>
				</div>
			</section>

			<section class="course-analytics" aria-label="Selected course grade analytics">
				<div class="course-analytics-head">
					<span class="gpa-kicker font-mono">Specific course analytics + projection</span>
					<h2>{activeCourse.code} Dashboard</h2>
					<p>The cards below only use grades and syllabus weights from the selected course.</p>
				</div>

				<section class="course-facts" aria-label="Grade analytics overview">
					<div class="course-fact">
						<span class="fact-label font-mono">Current standing</span>
						<strong class="fact-value"
							>{hasGradeEntries ? `${currentAverage.toFixed(1)}%` : '--'}</strong
						>
						<span class="fact-sub">
							{hasGradeEntries
								? `${completedWeight}% of ${activeCourse.code} graded`
								: 'no grade entries yet'}
						</span>
					</div>
					<div class="course-fact">
						<span class="fact-label font-mono">Projected result</span>
						{#if hasGradeEntries}
							<strong class={`fact-value trend-value ${courseProjectionDirection}`}>
								{projectedFinal.toFixed(1)}%
								<span
									class="trend-change"
									aria-label={`Course projection ${courseProjectionDirection}`}
								>
									<span class={`trend-icon ${courseProjectionDirection}`}></span>
									{courseProjectionDelta > 0 ? '+' : ''}{courseProjectionDelta.toFixed(1)}%
								</span>
							</strong>
						{:else}
							<strong class="fact-value">--</strong>
						{/if}
						<span class="fact-sub">
							{hasGradeEntries ? 'if ungraded work hits target' : 'waiting for course grades'}
						</span>
					</div>
					<div class="course-fact">
						<span class="fact-label font-mono">Projected GPA</span>
						{#if hasGradeEntries}
							<strong class={`fact-value trend-value ${projectedGpaDirection}`}>
								{projectedGpa.toFixed(2)}
								<span class="trend-change" aria-label={`GPA projection ${projectedGpaDirection}`}>
									<span class={`trend-icon ${projectedGpaDirection}`}></span>
									{projectedGpaDelta > 0 ? '+' : ''}{projectedGpaDelta.toFixed(2)}
								</span>
							</strong>
						{:else}
							<strong class="fact-value">--</strong>
						{/if}
						<span class="fact-sub">
							{hasGradeEntries ? 'after selected course projection' : 'waiting for course grades'}
						</span>
					</div>
					<div class="course-fact">
						<span class="fact-label font-mono">Needed on final</span>
						<strong
							class="fact-value {finalNeeded > 85 ? 'crit' : finalNeeded > 70 ? 'warn' : 'ok'}"
						>
							{hasGradeEntries ? `${finalNeeded.toFixed(0)}%` : '--'}
						</strong>
						<span class="fact-sub">{finalCategory?.weight ?? 0}% final weight</span>
					</div>
					<div class="course-fact">
						<span class="fact-label font-mono">Imported weights</span>
						<strong class="fact-value">{syllabusWeights.length}</strong>
						<span class="fact-sub">{activeCourse.code} categories</span>
					</div>
				</section>
			</section>

			<section class="gpa-projection-panel term-gpa-projection" aria-label="GPA target projection">
				<div class="target-gpa-box">
					<div class="target-head">
						<label class="target-label font-mono" for="target-gpa">Target GPA</label>
						<span class="target-value">{targetGpa.toFixed(1)}</span>
					</div>
					<input
						id="target-gpa"
						type="range"
						min="2"
						max={gpaScaleMaximum}
						step="0.1"
						bind:value={targetGpa}
					/>
				</div>
				<div class="gpa-projection-copy">
					<span class="index-label">GPA target projection</span>
					<p>
						{targetGpaDelta <= 0
							? 'Your projected GPA is already meeting the target.'
							: `You are ${targetGpaDelta.toFixed(2)} GPA points away from the target.`}
					</p>
					<div class="projection-scale compact" role="img" aria-label="GPA projection scale">
						<div class="scale-line">
							<span style="left: {Math.min(100, (dashboardTotalGpa / gpaScaleMaximum) * 100)}%"
							></span>
							<b style="left: {Math.min(100, (dashboardProjectedGpa / gpaScaleMaximum) * 100)}%"
							></b>
							<i style="left: {Math.min(100, (targetGpa / gpaScaleMaximum) * 100)}%"></i>
						</div>
						<div class="scale-labels font-mono">
							<span>total {dashboardTotalGpa.toFixed(2)}</span>
							<span>projected {dashboardProjectedGpa.toFixed(2)}</span>
							<span>target {targetGpa.toFixed(1)}</span>
						</div>
					</div>
				</div>
			</section>

			<div class="digest-grid">
				<section class="surface import-panel" aria-label="Import grades">
					<div class="import-panel-head">
						<div>
							<span class="gpa-kicker font-mono">Grade import</span>
							<h2>Update {activeCourse.code}</h2>
						</div>
						<span class="import-badge font-mono">{gradeItems.length} entries</span>
					</div>
					<p class="panel-copy">
						Add a score here and the course projection plus GPA projection update immediately.
					</p>

					<div class="grade-form">
						<label>
							<span class="field-label font-mono">Category</span>
							<select bind:value={selectedCategory}>
								{#each syllabusWeights as item (item.category)}
									<option value={item.category}>{item.category} - {item.weight}%</option>
								{/each}
							</select>
						</label>
						<label>
							<span class="field-label font-mono">Grade name</span>
							<input bind:value={gradeLabel} placeholder="e.g. Quiz 2" />
						</label>
						<div class="score-row">
							<label>
								<span class="field-label font-mono">Score</span>
								<input bind:value={gradeScore} inputmode="decimal" placeholder="18" />
							</label>
							<label>
								<span class="field-label font-mono">Out of</span>
								<input bind:value={gradeMax} inputmode="decimal" />
							</label>
						</div>
						<div class="form-actions">
							<button type="button" class="btn btn-primary" onclick={addGrade}>add grade</button>
							<button type="button" class="btn btn-secondary" onclick={importSampleGrades}>
								import sample
							</button>
						</div>
					</div>
				</section>

				<section class="surface projection-panel">
					<SectionHead title="Grade Projection" meta="what-if" />
					<div class="target-box course-target-box">
						<div class="target-head">
							<label class="target-label font-mono" for="target-grade">Target grade</label>
							<span class="target-value">{targetGrade}%</span>
						</div>
						<input id="target-grade" type="range" min="50" max="100" bind:value={targetGrade} />
					</div>
					<div class="projection-note">
						{#if hasGradeEntries}
							<p>
								To finish at <strong>{targetGrade}%</strong>, your current entries suggest you need
								<strong>{finalNeeded.toFixed(1)}%</strong> on the final.
							</p>
						{:else}
							<p>No course grades have been entered yet.</p>
						{/if}
					</div>

					<div class="projection-scale" role="img" aria-label="Projection scale">
						<div class="scale-line">
							{#if hasGradeEntries}
								<span style="left: {Math.min(100, currentAverage)}%"></span>
							{/if}
							<i style="left: {Math.min(100, targetGrade)}%"></i>
						</div>
						<div class="scale-labels font-mono">
							<span>current {hasGradeEntries ? `${currentAverage.toFixed(0)}%` : '--'}</span>
							<span>target {targetGrade}%</span>
						</div>
					</div>

					<div class="weight-list">
						{#each categoryAnalytics as item (item.category)}
							<div class="weight-row">
								<div>
									<span class="weight-name">{item.category}</span>
									<span class="weight-source font-mono">{item.source}</span>
								</div>
								<div class="weight-right">
									<span class="weight-num font-mono">{item.weight}%</span>
									<span class="status-chip {item.status}">
										{item.average === null ? 'missing' : item.average.toFixed(0) + '%'}
									</span>
								</div>
							</div>
						{/each}
					</div>
				</section>
			</div>

			<section class="surface-polaroid gradebook">
				<SectionHead
					title="Gradebook"
					meta={`${activeCourse.code} - ${gradeItems.length} entries`}
				/>
				<div class="gradebook-list">
					{#if gradeItems.length > 0}
						{#each gradeItems as item (item.id)}
							<div class="grade-row">
								<div class="grade-main">
									<span class="grade-category font-mono">{item.category}</span>
									<span class="grade-name">{item.label}</span>
								</div>
								<div class="grade-score">
									<span class="font-mono">{item.score}/{item.max}</span>
									<span>{((item.score / item.max) * 100).toFixed(1)}%</span>
									<button
										type="button"
										class="remove-btn"
										aria-label="Remove grade"
										onclick={() => removeGrade(item.id)}
									>
										x
									</button>
								</div>
							</div>
						{/each}
					{:else}
						<p class="empty-gradebook-note">
							No grade entries yet. Add a score to calculate course performance.
						</p>
					{/if}
				</div>
			</section>
		{/if}
	{/if}
</div>

<Dialog
	open={selectedHistoryCourse !== null}
	onOpenChange={(open) => {
		if (!open) closeHistoryCourse();
	}}
	title={selectedHistoryCourse?.code ?? 'Grade history'}
	description={selectedHistoryCourse?.name}
	class="history-dialog"
>
	{#if selectedHistoryCourse}
		<span class="gpa-kicker history-kicker font-mono">
			{selectedHistoryHasDetailedGrades ? 'Finished course gradebook' : 'Finished course record'}
		</span>
		<div class="history-modal-meta">
			<span>{selectedHistoryCourse.term}</span>
			<span>{selectedHistoryCourse.credits} credits</span>
			<strong>
				{selectedHistoryCourse.letter} -
				{letterToGpa(selectedHistoryCourse.letter)?.toFixed(2) ?? '--'} GPA
			</strong>
		</div>

		<div class="history-gradebook modal-gradebook">
			{#if selectedHistoryHasDetailedGrades}
				{#each selectedHistoryCourse.historyGrades ?? [] as grade (grade.label)}
					<div class="history-grade-item">
						<span>{grade.label}</span>
						<span class="font-mono">{grade.category}</span>
						<strong>{grade.score}/{grade.max}</strong>
						<span>{((grade.score / grade.max) * 100).toFixed(0)}%</span>
					</div>
				{/each}
			{:else}
				<p class="history-empty-note">
					No detailed gradebook can be shown because this course came from a transcript import.
					Quiz, assignment, and exam-level records were not included in the transcript.
				</p>
			{/if}
		</div>
	{/if}
</Dialog>

<style>
	.page {
		max-width: 1180px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.target-box {
		min-width: min(100%, 18rem);
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		padding: 0.85rem 1rem;
	}

	.target-label,
	.field-label {
		display: block;
		font-size: 0.68rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-bottom: 0.35rem;
	}

	.target-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.8rem;
		margin-bottom: 0.45rem;
	}

	.target-head .target-label {
		margin-bottom: 0;
	}

	.target-gpa-box input[type='range'],
	.target-box input[type='range'] {
		width: 100%;
		accent-color: var(--ink);
	}

	.target-value {
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1.05rem;
		color: var(--ink);
		line-height: 1;
	}

	.digest-grid {
		display: grid;
		grid-template-columns: minmax(280px, 0.9fr) minmax(360px, 1.2fr);
		gap: 1.25rem;
		margin-bottom: 1.25rem;
	}

	.digest-tabs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
		margin: 1.5rem 0 1rem;
		border-bottom: 1px solid var(--ink);
	}

	.digest-tabs button {
		display: grid;
		gap: 0.25rem;
		border: 1px solid var(--rule);
		border-bottom: 0;
		background: var(--paper-shelf);
		color: var(--ink-soft);
		cursor: pointer;
		padding: 0.75rem 1rem;
		text-align: left;
		transform: translateY(1px);
	}

	.digest-tabs button.active {
		border-color: var(--ink);
		background: var(--paper);
		color: var(--ink);
		box-shadow: inset 0 4px 0 var(--highlight);
	}

	.digest-tabs span {
		color: var(--ink-faint);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.digest-tabs strong {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.35rem;
		line-height: 1;
	}

	.performance-panel {
		margin: 1.5rem 0;
		border: 1px solid var(--ink);
		background: var(--paper);
	}

	.performance-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid var(--rule);
	}

	.performance-head h2 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.7rem;
		line-height: 1;
	}

	.performance-delta {
		border: 1px solid var(--ink);
		background: var(--highlight-soft);
		padding: 0.65rem 0.8rem;
		min-width: 8rem;
	}

	.performance-delta strong {
		display: block;
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1.8rem;
		line-height: 1;
		margin-top: 0.35rem;
	}

	.performance-body {
		display: grid;
		grid-template-columns: minmax(18rem, 1fr) minmax(18rem, 1fr);
		gap: 1rem;
		margin-top: 1rem;
	}

	.performance-chart {
		display: grid;
		grid-template-columns: repeat(9, minmax(0, 1fr));
		gap: 0.35rem;
		align-items: end;
		min-height: 17rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		padding: 1rem 0.65rem 0.85rem;
		overflow: hidden;
	}

	.term-bar {
		display: grid;
		grid-template-rows: 1fr auto auto auto;
		gap: 0.25rem;
		align-items: end;
		height: 100%;
		min-width: 0;
		text-align: center;
	}

	.term-bar-track {
		position: relative;
		height: 10.5rem;
		border: 1px solid var(--rule);
		background: var(--paper);
	}

	.term-bar-track span {
		position: absolute;
		inset-inline: 0;
		bottom: 0;
		background: var(--accent);
	}

	.term-bar-track span.up {
		background: var(--ok);
	}

	.term-bar-track span.down {
		background: var(--accent);
	}

	.term-bar-track span.same {
		background: var(--ink-faint);
	}

	.term-bar strong {
		display: block;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 0.88rem;
		line-height: 1;
		white-space: nowrap;
	}

	.term-bar small {
		color: var(--ink-faint);
		font-size: 0.68rem;
		letter-spacing: 0;
	}

	.performance-list {
		display: grid;
		gap: 0.3rem;
		max-height: 17rem;
		overflow-y: auto;
		padding-right: 0.35rem;
		scrollbar-color: var(--ink-faint) var(--paper-shelf);
		scrollbar-width: thin;
	}

	.performance-row {
		display: grid;
		grid-template-columns: minmax(3.5rem, 0.45fr) minmax(8rem, 1fr) auto minmax(8rem, 1fr);
		gap: 0.55rem;
		align-items: center;
		border: 1px solid var(--rule-soft);
		background: var(--paper);
		color: var(--ink-soft);
		font-size: 0.76rem;
		padding: 0.42rem 0.55rem;
	}

	.performance-row span:nth-child(4) {
		display: none;
	}

	.performance-row strong {
		display: inline-flex;
		gap: 0.3rem;
		align-items: center;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1.2rem;
		line-height: 1;
	}

	.trend-value.up {
		color: var(--ok);
	}

	.trend-value.down {
		color: var(--accent);
	}

	.trend-value.same {
		color: var(--ink-faint);
	}

	.trend-icon {
		position: relative;
		display: inline-block;
		width: 0.7em;
		height: 0.7em;
		flex-shrink: 0;
	}

	.trend-icon::before {
		content: '';
		position: absolute;
		inset: 0.16em;
		border-right: 0.16em solid currentColor;
		border-top: 0.16em solid currentColor;
	}

	.trend-icon.up {
		color: var(--ok);
	}

	.trend-icon.up::before {
		transform: rotate(-45deg);
	}

	.trend-icon.down {
		color: var(--accent);
	}

	.trend-icon.down::before {
		transform: rotate(135deg);
	}

	.trend-icon.same {
		color: var(--ink-faint);
	}

	.trend-icon.same::before {
		top: 0.34em;
		right: 0;
		left: 0;
		height: 0;
		border-top: 0.16em solid currentColor;
		border-right: 0;
		transform: none;
	}

	.trend-change {
		display: inline-flex;
		gap: 0.15rem;
		align-items: center;
		font-family: var(--font-mono);
		font-size: 0.65em;
		line-height: 1;
		white-space: nowrap;
	}

	.term-bar .trend-change {
		display: block;
		font-size: 0.68rem;
	}

	.term-bar > .trend-icon {
		justify-self: center;
		font-size: 0.9rem;
	}

	/* Compact facts line that replaced the course-analytics index-bar strip. */
	.course-facts {
		display: flex;
		flex-wrap: wrap;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		padding: 0.6rem 0;
		margin-top: 0.75rem;
	}

	.course-fact {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
		padding: 0.3rem 1.25rem;
		border-left: 1px solid var(--rule);
	}

	.course-fact:first-child {
		border-left: 0;
	}

	.fact-label {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
	}

	.fact-value {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.15rem 0.4rem;
		align-items: baseline;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1.05rem;
		line-height: 1.2;
	}

	.fact-value.crit {
		color: var(--accent);
	}

	.fact-value.warn {
		color: var(--warn);
	}

	.fact-value.ok {
		color: var(--ok);
	}

	.fact-value .trend-change {
		margin-left: 0.1rem;
	}

	.fact-sub {
		font-size: 0.72rem;
		color: var(--ink-soft);
	}

	.term-performance-panel {
		margin-top: 1rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		padding: 1rem;
	}

	.term-performance-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid var(--rule-soft);
	}

	.term-performance-head h3 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.45rem;
		line-height: 1;
	}

	.term-select-box {
		width: min(100%, 18rem);
		flex-shrink: 0;
	}

	.term-course-chart {
		display: grid;
		gap: 0.55rem;
		margin-top: 1rem;
	}

	.term-course-bar {
		display: grid;
		grid-template-columns: minmax(8rem, 0.7fr) minmax(12rem, 1fr) auto;
		gap: 0.75rem;
		align-items: center;
		border: 1px solid var(--rule-soft);
		background: var(--paper);
		padding: 0.55rem 0.65rem;
	}

	.term-course-bar div:first-child {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		min-width: 0;
	}

	.term-course-bar span {
		color: var(--ink);
		font-size: 0.78rem;
	}

	.term-course-bar strong {
		color: var(--ink-soft);
		font-size: 0.72rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.term-course-bar small {
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1rem;
		line-height: 1;
	}

	.course-bar-track {
		height: 0.7rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
	}

	.course-bar-track span {
		display: block;
		height: 100%;
		background: var(--highlight);
	}

	.course-dashboard-heading {
		margin: 2.25rem 0 0.9rem;
	}

	.course-dashboard-heading p {
		max-width: 34rem;
		margin: 0.55rem 0 0;
		color: var(--ink-soft);
		font-size: 0.92rem;
		line-height: 1.5;
	}

	.course-link {
		display: flex;
		justify-content: space-between;
		gap: 1.25rem;
		align-items: center;
		margin: 0 0 1.75rem;
		border: 2px solid var(--ink);
		background: var(--paper-shelf);
	}

	.course-link-main {
		display: grid;
		grid-template-columns: minmax(14rem, 0.8fr) minmax(16rem, 1fr);
		gap: 1.25rem;
		align-items: center;
		min-width: 0;
	}

	.course-link-label {
		display: block;
		color: var(--ink-faint);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-bottom: 0.35rem;
	}

	.course-link-title {
		display: flex;
		align-items: baseline;
		gap: 0.65rem;
		margin: 0;
		color: var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.5rem;
		line-height: 1.1;
	}

	.course-code {
		color: var(--accent);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.course-link-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.course-link-meta span {
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		font-size: 0.78rem;
		padding: 0.25rem 0.5rem;
	}

	.course-select-box {
		width: min(100%, 20rem);
		flex-shrink: 0;
	}

	.select-shell {
		position: relative;
	}

	.course-select-box select,
	.term-select-box select {
		width: 100%;
		border: 2px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: 0.9rem;
		padding: 0.55rem 2.2rem 0.55rem 0.65rem;
		appearance: none;
		cursor: pointer;
	}

	.dropdown-arrow {
		position: absolute;
		right: 0.7rem;
		top: 50%;
		width: 1.2rem;
		height: 1.2rem;
		transform: translateY(-50%);
		border: 1px solid var(--ink);
		background: var(--highlight-soft);
		color: var(--ink);
		font-size: 0.7rem;
		line-height: 1.1rem;
		text-align: center;
		pointer-events: none;
	}

	.course-link-actions {
		display: flex;
		gap: 0.55rem;
		flex-wrap: wrap;
		justify-content: flex-end;
		margin-top: 0.75rem;
	}

	.gpa-panel {
		display: grid;
		grid-template-columns: minmax(16rem, 0.75fr) minmax(24rem, 1.25fr);
		gap: 1.15rem;
		align-items: stretch;
		margin-bottom: 1.25rem;
		border: 1px solid var(--ink);
		background: var(--paper);
	}

	.gpa-hero {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 1.1rem;
		min-height: 11rem;
	}

	.gpa-kicker {
		display: block;
		color: var(--accent);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-bottom: 0.4rem;
	}

	.gpa-title {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: clamp(1.9rem, 4vw, 2.5rem);
		line-height: 1;
	}

	.gpa-copy {
		max-width: 28rem;
		margin: 0.55rem 0 0;
		color: var(--ink-soft);
		font-size: 0.92rem;
		line-height: 1.5;
	}

	.transcript-upload-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		align-items: center;
	}

	.gpa-scale-control {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		padding: 0.35rem 0.45rem;
	}

	.gpa-scale-control span {
		color: var(--ink-faint);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.gpa-scale-control select {
		border: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.upload-transcript {
		position: relative;
		overflow: hidden;
	}

	.upload-transcript input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.source-note {
		color: var(--ink-faint);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.upload-error {
		margin: 0;
		color: var(--accent);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.digest-source-strip {
		grid-column: 1 / -1;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		padding: 0.75rem 0.85rem;
	}

	.digest-source-strip strong {
		display: block;
		margin-top: 0.25rem;
		color: var(--ink);
		font-size: 0.9rem;
		font-weight: 500;
	}

	.target-gpa-box {
		width: min(100%, 18rem);
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		padding: 0.8rem 0.9rem;
	}

	/* Compact label/value facts band that replaced the three-card gpa-metrics grid. */
	.gpa-facts {
		display: grid;
		align-self: start;
		margin: 0;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
	}

	.gpa-facts > div {
		display: grid;
		grid-template-columns: minmax(6.5rem, auto) 1fr;
		gap: 0.35rem 0.9rem;
		align-items: baseline;
		padding: 0.55rem 0.85rem;
		border-bottom: 1px solid var(--rule-soft);
	}

	.gpa-facts > div:last-child {
		border-bottom: 0;
	}

	.gpa-facts dt {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}

	.gpa-facts dd {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem 0.4rem;
		align-items: baseline;
		margin: 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1.1rem;
		line-height: 1.25;
	}

	.gpa-facts dd span:not(.trend-icon) {
		color: var(--ink-soft);
		font-size: 0.78rem;
		font-weight: 500;
	}

	.gpa-facts dd.up {
		color: var(--ok);
	}

	.gpa-facts dd.down {
		color: var(--warn);
	}

	.gpa-facts dd.same {
		color: var(--ink-faint);
	}

	.gpa-facts .trend-icon.down {
		color: var(--warn);
	}

	.transcript-columns {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.85rem;
		padding-top: 0.35rem;
		border-top: 1px solid var(--rule);
	}

	.transcript-column {
		min-width: 0;
		border: 1px solid var(--rule);
		background: var(--paper);
		padding: 0.55rem;
	}

	.transcript-column-head {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		border-bottom: 1px solid var(--rule-soft);
		color: var(--ink-faint);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding-bottom: 0.45rem;
	}

	.transcript-column-head strong {
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1.2rem;
		line-height: 1;
	}

	.transcript-list {
		display: grid;
		gap: 0.3rem;
		max-height: min(32vh, 13rem);
		overflow-y: auto;
		overscroll-behavior: contain;
		margin-top: 0.45rem;
		padding-right: 0.35rem;
		scrollbar-color: var(--ink-faint) var(--paper-shelf);
		scrollbar-width: thin;
	}

	.gpa-course-row {
		display: grid;
		grid-template-columns: minmax(5.5rem, 0.8fr) minmax(6rem, 1fr) minmax(5rem, 0.75fr) minmax(
				6rem,
				0.95fr
			);
		gap: 0.45rem;
		align-items: center;
		border: 1px solid var(--rule-soft);
		background: var(--paper);
		color: var(--ink-soft);
		font-size: 0.76rem;
		min-height: 2.25rem;
		padding: 0.35rem 0.55rem;
		width: 100%;
		text-align: left;
	}

	.current-column .gpa-course-row {
		grid-template-columns: minmax(5.5rem, 0.85fr) minmax(6rem, 1fr) minmax(5rem, 0.75fr);
	}

	.gpa-course-row.current {
		border-color: var(--ok);
		background: color-mix(in srgb, var(--ok) 8%, var(--paper));
		color: var(--ink);
	}

	.gpa-course-row.finished {
		border-color: var(--rule);
		background: var(--paper-shelf);
		color: var(--warn);
	}

	.history-trigger {
		cursor: pointer;
		transition:
			background 0.12s var(--ease-out-quart),
			border-color 0.12s var(--ease-out-quart),
			transform 0.12s var(--ease-out-quart);
	}

	.history-trigger:hover {
		background: var(--paper);
		border-color: var(--ink);
		transform: translateX(2px);
	}

	/* Standard selected pattern: ink border + highlighter-soft fill. */
	.gpa-course-row.active {
		border-color: var(--ink);
		color: var(--ink);
		background: var(--highlight-soft);
	}

	.history-open-label {
		color: var(--warn);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	:global(.ui-dialog-content.history-dialog) {
		width: min(46rem, calc(100vw - 2rem));
	}

	.history-kicker {
		margin-bottom: 0.55rem;
	}

	.history-modal-meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		color: var(--ink-soft);
		font-size: 0.78rem;
	}

	.history-modal-meta strong {
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 0.95rem;
		line-height: 1;
		padding: 0.25rem 0.45rem;
	}

	.history-gradebook {
		display: grid;
		gap: 0.4rem;
		margin-top: 0.65rem;
	}

	.modal-gradebook {
		margin-top: 1rem;
	}

	.history-grade-item {
		display: grid;
		grid-template-columns: minmax(10rem, 1.3fr) minmax(6rem, 0.7fr) auto auto;
		gap: 0.65rem;
		align-items: center;
		border: 1px solid var(--rule-soft);
		background: var(--paper);
		color: var(--ink-soft);
		font-size: 0.78rem;
		padding: 0.5rem 0.6rem;
	}

	.history-grade-item strong {
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.74rem;
	}

	.history-empty-note,
	.empty-gradebook-note {
		margin: 0;
		border: 1px dashed var(--ink-faint);
		background: var(--paper-shelf);
		color: var(--ink-soft);
		font-size: 0.86rem;
		line-height: 1.5;
		padding: 0.8rem;
	}

	.gpa-projection-panel {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: minmax(14rem, 0.35fr) minmax(20rem, 1fr);
		gap: 1rem;
		align-items: stretch;
		border: 1px solid var(--ink);
		background: var(--paper-shelf);
		padding: 1rem;
	}

	.gpa-projection-copy {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
	}

	.gpa-projection-copy p {
		margin: 0.3rem 0 0.9rem;
		color: var(--ink);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.course-analytics {
		margin-bottom: 1.25rem;
	}

	.empty-course-state {
		margin-top: 1rem;
		padding: 1.25rem;
	}

	.empty-course-state h2 {
		margin: 0.35rem 0;
		color: var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.8rem;
	}

	.empty-course-state p {
		margin: 0;
		color: var(--ink-soft);
		line-height: 1.5;
	}

	.course-analytics .course-facts {
		margin-top: 0.75rem;
	}

	.course-analytics-head {
		margin-bottom: 0.75rem;
		padding: 0 0.25rem;
	}

	.course-analytics-head h2 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.65rem;
		line-height: 1.1;
	}

	.course-analytics-head p {
		margin: 0.35rem 0 0;
		color: var(--ink-soft);
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.panel-copy {
		margin: 1rem 0;
		color: var(--ink-soft);
		font-size: 0.9rem;
		line-height: 1.55;
	}

	.import-panel {
		border: 2px solid var(--ink);
		background: var(--paper);
	}

	.import-panel-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid var(--ink);
	}

	.import-panel-head h2 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.75rem;
		line-height: 1;
	}

	.import-badge {
		border: 1px solid var(--ink);
		background: var(--highlight-soft);
		color: var(--ink);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 0.35rem 0.5rem;
		white-space: nowrap;
	}

	.grade-form {
		display: grid;
		gap: 0.85rem;
	}

	.grade-form input,
	.grade-form select {
		width: 100%;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: 0.9rem;
		padding: 0.55rem 0.65rem;
	}

	.score-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.form-actions {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.import-panel .btn-primary {
		font-weight: 700;
	}

	.projection-note {
		margin: 1rem 0 1.25rem;
		padding: 0.95rem 1rem;
		border: 1px solid var(--accent);
		background: var(--paper-shelf);
		color: var(--ink);
	}

	.course-target-box {
		width: 100%;
		margin-top: 1rem;
	}

	.projection-note p {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.55;
	}

	.projection-scale {
		margin-bottom: 1.25rem;
	}

	.projection-scale.compact {
		margin-bottom: 0;
	}

	.scale-line {
		position: relative;
		height: 0.45rem;
		background: var(--rule-soft);
		border: 1px solid var(--rule);
	}

	.scale-line span,
	.scale-line b,
	.scale-line i {
		position: absolute;
		top: -0.35rem;
		width: 0.15rem;
		height: 1.1rem;
		background: var(--ink);
	}

	.scale-line b {
		background: var(--ok);
	}

	.scale-line i {
		background: var(--accent);
	}

	.scale-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.5rem;
		color: var(--ink-faint);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.weight-list,
	.gradebook-list {
		display: grid;
		gap: 0;
		margin-top: 1rem;
	}

	.weight-row,
	.grade-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 0;
		border-bottom: 1px solid var(--rule-soft);
	}

	.weight-row:last-child,
	.grade-row:last-child {
		border-bottom: 0;
	}

	.weight-name,
	.grade-name {
		display: block;
		color: var(--ink);
		font-size: 0.95rem;
		font-weight: 500;
	}

	.weight-source,
	.grade-category {
		display: block;
		color: var(--ink-faint);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-top: 0.2rem;
	}

	.weight-right,
	.grade-score {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-shrink: 0;
	}

	.weight-num {
		font-size: 0.78rem;
		color: var(--ink-soft);
	}

	.status-chip.strong,
	.status-chip.steady,
	.ok {
		color: var(--ok);
	}

	.status-chip.review,
	.warn {
		color: var(--warn);
	}

	.status-chip.waiting {
		color: var(--ink-faint);
	}

	.gradebook {
		padding: 1.25rem;
	}

	.grade-main {
		min-width: 0;
	}

	.grade-score {
		color: var(--ink);
		font-size: 0.88rem;
	}

	.remove-btn {
		border: 1px solid rgba(194, 54, 42, 0.35);
		border-radius: 0;
		background: transparent;
		color: var(--pen-red);
		width: 1.45rem;
		height: 1.45rem;
		cursor: pointer;
		line-height: 1;
		transition:
			background 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart);
	}

	.remove-btn:hover {
		background: var(--pen-red);
		color: var(--paper);
	}

	@media (max-width: 1024px) {
		.gpa-panel {
			grid-template-columns: 1fr;
		}

		.gpa-projection-panel {
			grid-template-columns: 1fr;
		}

		.performance-body,
		.term-course-bar,
		.transcript-columns {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 900px) {
		.digest-grid {
			grid-template-columns: 1fr;
		}

		.course-link,
		.course-link-main {
			display: grid;
			grid-template-columns: 1fr;
			align-items: stretch;
		}

		.course-select-box {
			width: 100%;
		}

		.course-link-actions {
			justify-content: flex-start;
		}

		.course-facts {
			flex-direction: column;
			padding: 0;
		}

		.course-fact {
			padding: 0.55rem 0.9rem;
			border-left: 0;
			border-top: 1px solid var(--rule-soft);
		}

		.course-fact:first-child {
			border-top: 0;
		}

		.performance-head,
		.performance-row {
			grid-template-columns: 1fr;
		}

		.performance-head {
			display: grid;
		}

		.digest-source-strip {
			align-items: flex-start;
			flex-direction: column;
		}

		.term-performance-head {
			display: grid;
		}
	}

	@media (max-width: 640px) {
		.digest-tabs {
			grid-template-columns: 1fr;
		}

		.weight-row,
		.grade-row {
			flex-direction: column;
			align-items: flex-start;
		}

		.score-row,
		.gpa-course-row,
		.history-grade-item,
		.performance-row {
			grid-template-columns: 1fr;
		}

		.history-modal-meta {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
