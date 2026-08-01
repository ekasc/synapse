<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import { Dialog } from '$lib/components/ui';
	import { Select } from 'bits-ui';

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

	type GpaScale = 'percent-100' | 'scale-4.0' | 'scale-4.4';

	type TranscriptImportPreview = {
		semesterCount: number;
		courseCount: number;
		terms: string[];
	};

	type SyllabusGrading = {
		courseId: string;
		grading: Array<{
			label: string;
			weight: number;
		}>;
	};

	let {
		data
	}: {
		data: {
			courses: SetupCourse[];
			digest: AcademicDigest;
			semesters: SetupSemester[];
			syllabusGrading: SyllabusGrading[];
			transcriptImportPreview: TranscriptImportPreview | null;
		};
	} = $props();

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
	let gpaScale = $state<GpaScale>('scale-4.4');
	let courseSearch = $state('');
	let courseStatusFilter = $state<'all' | 'current' | 'finished'>('all');
	let courseSort = $state<'term' | 'gpa-desc' | 'gpa-asc'>('term');
	let activeDigestTab = $state<'gpa' | 'term'>('gpa');
	let selectedPerformanceTerm = $state('');
	let performanceTermTouched = $state(false);
	let selectedHistoryCourseId = $state<string | null>(null);
	let backendDigest = $state<AcademicDigest | null>(null);
	let transcriptUploading = $state(false);
	let digestResetting = $state(false);
	let transcriptUploadError = $state('');
	let transcriptImportPromptOpen = $state(false);
	let transcriptImporting = $state(false);
	let transcriptImportMessage = $state('');
	let promptedTranscriptKey = '';

	function gradeColor(percent: number) {
		if (percent >= 90) return 'var(--ok)';
		if (percent >= 80) return 'var(--pen-blue)';
		if (percent >= 70) return 'var(--warn)';
		return 'var(--accent)';
	}

	$effect(() => {
		const preview = data.transcriptImportPreview;
		const promptKey = preview ? `${data.digest.updatedAt}:${preview.courseCount}` : '';
		if (preview && promptKey !== promptedTranscriptKey) {
			promptedTranscriptKey = promptKey;
			transcriptImportPromptOpen = true;
		}
	});

	const importedCourseDigests = $derived.by(() =>
		data.courses.map((course, index) => {
			const semester = data.semesters.find((item) => item.id === course.semesterId);
			const extractedWeights =
				data.syllabusGrading
					.find((syllabus) => syllabus.courseId === course.id)
					?.grading.filter(
						(item) =>
							item.label.trim().length > 0 &&
							Number.isFinite(item.weight) &&
							item.weight > 0 &&
							item.weight <= 100
					)
					.map((item) => ({
						category: item.label.trim(),
						weight: item.weight,
						source: 'extracted syllabus'
					})) ?? [];
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
				weights: extractedWeights.length > 0 ? extractedWeights : defaultWeights,
				initialGrades: [],
				transcript: {
					currentPercent,
					projectedPercent
				}
			};
		})
	);

	const courses = $derived(importedCourseDigests);
	const activeBackendDigest = $derived(backendDigest ?? data.digest);
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
	const filteredDashboardCourses = $derived.by(() => {
		const query = courseSearch.trim().toLowerCase();
		const filtered = dashboardTranscriptCourses.filter((course) => {
			const matchesStatus = courseStatusFilter === 'all' || course.status === courseStatusFilter;
			const matchesSearch =
				!query || `${course.code} ${course.name} ${course.term}`.toLowerCase().includes(query);
			return matchesStatus && matchesSearch;
		});

		if (courseSort === 'gpa-desc') {
			return [...filtered].sort((a, b) => b.currentPercent - a.currentPercent);
		}
		if (courseSort === 'gpa-asc') {
			return [...filtered].sort((a, b) => a.currentPercent - b.currentPercent);
		}
		return filtered;
	});
	const filteredCurrentCourses = $derived(
		filteredDashboardCourses.filter((course) => course.status === 'current')
	);
	const filteredFinishedCourses = $derived(
		filteredDashboardCourses.filter((course) => course.status === 'finished')
	);
	const hasAcademicProgressData = $derived(dashboardTranscriptCourses.length > 0);
	const gpaScaleMaximum = $derived(
		gpaScale === 'percent-100' ? 100 : gpaScale === 'scale-4.4' ? 4.4 : 4
	);
	const gpaScaleMinimum = $derived(gpaScale === 'percent-100' ? 50 : 2);
	const calculatedDashboardTotalGpa = $derived(
		weightedGpa(dashboardTranscriptCourses, 'currentPercent')
	);
	const dashboardTotalGpa = $derived(
		gpaScale === 'scale-4.4' && activeBackendDigest.source === 'transcript-upload'
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
					isLatest && gpaScale === 'scale-4.4'
						? dashboardTotalGpa
						: weightedGpa(cumulativeCourses, 'currentPercent')
			};
		});
	});
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
	const latestTermDelta = $derived(
		performanceTrendWithDelta[performanceTrendWithDelta.length - 1]?.delta ?? 0
	);
	const strongestDashboardCourse = $derived.by(() =>
		dashboardTranscriptCourses.reduce<TranscriptCourse | null>(
			(strongest, course) =>
				!strongest || course.currentPercent > strongest.currentPercent ? course : strongest,
			null
		)
	);
	const lowestCurrentCourse = $derived.by(() =>
		dashboardCurrentTranscriptCourses.reduce<TranscriptCourse | null>(
			(lowest, course) =>
				!lowest || course.currentPercent < lowest.currentPercent ? course : lowest,
			null
		)
	);
	const dashboardGoalDelta = $derived(targetGpa - dashboardTotalGpa);
	const dashboardGoalProgress = $derived(
		Math.min(100, Math.max(0, (dashboardTotalGpa / Math.max(targetGpa, 0.1)) * 100))
	);
	const dashboardInsights = $derived.by(() => {
		const insights: string[] = [...(activeBackendDigest.insights ?? []).slice(0, 2)];
		insights.push(
			`${performanceDelta >= 0 ? 'GPA increased' : 'GPA decreased'} by ${Math.abs(performanceDelta).toFixed(2)} compared with your first tracked term.`
		);
		if (strongestDashboardCourse) {
			insights.push(
				`Strongest course: ${strongestDashboardCourse.code} at ${strongestDashboardCourse.currentPercent.toFixed(0)}%.`
			);
		}
		if (lowestCurrentCourse) {
			insights.push(
				lowestCurrentCourse.currentPercent < 75
					? `Needs attention: ${lowestCurrentCourse.code} is currently at ${lowestCurrentCourse.currentPercent.toFixed(0)}%.`
					: `Current courses are steady; the lowest standing is ${lowestCurrentCourse.code} at ${lowestCurrentCourse.currentPercent.toFixed(0)}%.`
			);
		}
		insights.push(`Projected GPA at the current pace: ${dashboardProjectedGpa.toFixed(2)}.`);
		return insights.slice(0, 4);
	});

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
		if (gpaScale === 'percent-100' && targetGpa < gpaScaleMinimum) targetGpa = 85;
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
		const scale44: Record<string, number> = {
			...standard,
			'A+': 4.4,
			'A-': 3.67,
			'B+': 3.33,
			'B-': 2.67,
			'C+': 2.33,
			'C-': 1.67,
			'D+': 1.33
		};
		return (gpaScale === 'scale-4.4' ? scale44 : standard)[letter.toUpperCase()] ?? null;
	}

	function percentToGpa(percent: number) {
		if (gpaScale === 'percent-100') return percent;
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

	async function importTranscriptIntoSemesters() {
		transcriptImporting = true;
		transcriptUploadError = '';
		try {
			const response = await fetch('/api/digest/transcript/import', { method: 'POST' });
			const result = (await response.json()) as {
				ok?: boolean;
				imported?: TranscriptImportPreview;
				error?: string;
			};
			if (!response.ok || !result.ok || !result.imported) {
				throw new Error(result.error ?? 'Could not import transcript courses');
			}
			transcriptImportMessage = `Imported ${result.imported.courseCount} course${
				result.imported.courseCount === 1 ? '' : 's'
			} across ${result.imported.terms.length} semester${
				result.imported.terms.length === 1 ? '' : 's'
			}.`;
			transcriptImportPromptOpen = false;
			await invalidateAll();
		} catch (error) {
			transcriptUploadError =
				error instanceof Error ? error.message : 'Could not import transcript courses';
		} finally {
			transcriptImporting = false;
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

<svelte:head><title>Grades &amp; GPA · Synapse</title></svelte:head>

<div class="page page-enter">
	<div class="page-cover">
		<div class="page-cover-row">
			<div>
				<h1 class="page-title">Academic Progress</h1>
				<p class="page-tagline">
					See your cumulative GPA, credit progress, and course history in one place.
				</p>
			</div>
		</div>
	</div>

	<div class="digest-tabs" role="tablist" aria-label="Grade dashboard views">
		<button
			type="button"
			class:active={activeDigestTab === 'gpa'}
			role="tab"
			aria-selected={activeDigestTab === 'gpa'}
			onclick={() => (activeDigestTab = 'gpa')}
		>
			<strong>Overview</strong>
		</button>
		<button
			type="button"
			class:active={activeDigestTab === 'term'}
			role="tab"
			aria-selected={activeDigestTab === 'term'}
			onclick={() => (activeDigestTab = 'term')}
		>
			<strong>Current term</strong>
		</button>
	</div>

	{#if activeDigestTab === 'gpa'}
		<section class="surface gpa-panel" aria-label="Total GPA projection">
			<div class="gpa-hero">
				<div class="transcript-upload-actions">
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
				</div>
				<div class="gpa-scale-setting">
					<span>Display scale</span>
					<div class="gpa-scale-control">
						<Select.Root
							type="single"
							items={[
								{ value: 'percent-100', label: 'Scale 100' },
								{ value: 'scale-4.0', label: 'Scale 4.0' },
								{ value: 'scale-4.4', label: 'Scale 4.4' }
							]}
							bind:value={gpaScale}
						>
							<Select.Trigger class="gpa-scale-trigger" aria-label="GPA scale">
								<Select.Value />
								<span class="gpa-scale-chevron" aria-hidden="true"></span>
							</Select.Trigger>
							<Select.Portal>
								<Select.Content class="gpa-scale-menu" sideOffset={3}>
									<Select.Viewport>
										<Select.Item value="percent-100" label="Scale 100" class="gpa-scale-option"
											>Scale 100</Select.Item
										>
										<Select.Item value="scale-4.0" label="Scale 4.0" class="gpa-scale-option"
											>Scale 4.0</Select.Item
										>
										<Select.Item value="scale-4.4" label="Scale 4.4" class="gpa-scale-option"
											>Scale 4.4</Select.Item
										>
									</Select.Viewport>
								</Select.Content>
							</Select.Portal>
						</Select.Root>
					</div>
				</div>
			</div>
			{#if transcriptUploadError}
				<p class="upload-error">{transcriptUploadError}</p>
			{/if}
			{#if transcriptImportMessage}
				<p class="transcript-import-success" role="status">{transcriptImportMessage}</p>
			{/if}

			<dl class="gpa-facts">
				<div class="gpa-fact-primary">
					<dt>Cumulative GPA</dt>
					<dd>
						{hasAcademicProgressData ? dashboardTotalGpa.toFixed(2) : '--'}
						<span class="gpa-value-unit">GPA</span>
					</dd>
					<div class="hero-gpa-support">
						<span class={dashboardProjectedGpa >= dashboardTotalGpa ? 'up' : 'down'}>
							Projected {dashboardProjectedGpa.toFixed(2)}
						</span>
						<span>
							{dashboardGoalDelta > 0
								? `Need +${dashboardGoalDelta.toFixed(2)} to reach target`
								: 'Target GPA reached'}
						</span>
					</div>
				</div>
				<div class="gpa-fact-trend">
					<dt>GPA movement</dt>
					<dd
						class={hasAcademicProgressData
							? latestTermDelta > 0
								? 'up'
								: latestTermDelta < 0
									? 'down'
									: 'same'
							: ''}
					>
						{#if hasAcademicProgressData}
							{latestTermDelta >= 0 ? '+' : ''}{latestTermDelta.toFixed(2)}
							<span class="movement-unit">GPA</span>
						{:else}
							--
						{/if}
					</dd>
					<span class="metric-note">Compared with previous semester</span>
				</div>
				<div class="gpa-fact-credits">
					<dt>Credits earned</dt>
					<dd>
						{activeBackendDigest.currentCredits + activeBackendDigest.finishedCredits}
						<span class="metric-unit">tracked</span>
						<span>· {activeBackendDigest.currentCredits} in progress</span>
						<span>· {activeBackendDigest.finishedCredits} from history</span>
					</dd>
				</div>
			</dl>

			<div class="dashboard-intelligence">
				<section class="insight-panel" aria-labelledby="ai-insights-title">
					<div class="intelligence-heading">
						<div>
							<span>🤖 Synapse AI</span>
							<h2 id="ai-insights-title">This semester</h2>
						</div>
						<strong>Insights</strong>
					</div>
					<ul>
						{#each dashboardInsights as insight, index (insight)}
							<li>
								<span class="insight-symbol" aria-hidden="true">
									{index === 2 ? '⚠' : index === 3 ? '🎯' : '✓'}
								</span>
								{insight}
							</li>
						{/each}
					</ul>
				</section>

				<section class="goal-panel" aria-labelledby="academic-goal-title">
					<div class="intelligence-heading">
						<div>
							<span>Academic goal</span>
							<h2 id="academic-goal-title">Target GPA</h2>
						</div>
						<strong>{targetGpa.toFixed(1)}</strong>
					</div>
					<div class="goal-values">
						<div>
							<span>Current</span>
							<strong>{dashboardTotalGpa.toFixed(2)}</strong>
						</div>
						<div>
							<span>Need</span>
							<strong>{Math.max(0, dashboardGoalDelta).toFixed(2)}</strong>
						</div>
					</div>
					<div
						class="goal-progress"
						role="progressbar"
						aria-label="Progress toward target GPA"
						aria-valuenow={dashboardGoalProgress}
						aria-valuemin="0"
						aria-valuemax="100"
					>
						<span style={`width: ${dashboardGoalProgress}%`}></span>
					</div>
					<label class="goal-control">
						<span>Adjust target</span>
						<input
							type="range"
							min={gpaScaleMinimum}
							max={gpaScaleMaximum}
							step="0.1"
							bind:value={targetGpa}
						/>
					</label>
				</section>
			</div>

			<div class="course-filter-bar" aria-label="Filter academic courses">
				<label class="course-search-control">
					<span>Search courses</span>
					<input type="search" placeholder="Code, name, or term" bind:value={courseSearch} />
				</label>
				<label>
					<span>Status</span>
					<select bind:value={courseStatusFilter}>
						<option value="all">All courses</option>
						<option value="current">Current only</option>
						<option value="finished">Completed only</option>
					</select>
				</label>
				<label>
					<span>Sort</span>
					<select bind:value={courseSort}>
						<option value="term">Academic term</option>
						<option value="gpa-desc">Highest grade</option>
						<option value="gpa-asc">Lowest grade</option>
					</select>
				</label>
			</div>

			<div class="transcript-columns" role="group" aria-label="Courses included in GPA">
				{#if courseStatusFilter !== 'finished'}
					<div class="transcript-column current-column">
						<div class="transcript-column-head">
							<span>Current courses</span>
							<strong>{filteredCurrentCourses.length}</strong>
						</div>
						<div class="transcript-list current-course-grid" role="list">
							{#if filteredCurrentCourses.length > 0}
								{#each filteredCurrentCourses as course (course.id)}
									<article
										class:active={course.id === selectedCourseId}
										class="course-visual-card current"
										role="listitem"
									>
										<div class="course-card-heading">
											<div>
												<strong>{course.code}</strong>
												<span>{course.name}</span>
											</div>
											<div class="course-score">
												<strong>{course.currentPercent.toFixed(0)}%</strong>
												<span>{percentToGpa(course.currentPercent).toFixed(2)} GPA</span>
											</div>
										</div>
										<div class="course-progress">
											<span style={`width: ${Math.min(100, course.currentPercent)}%`}></span>
										</div>
										<div class="course-card-meta">
											<span>{course.term}</span>
											<span>Projected {percentToLetter(course.projectedPercent)}</span>
											<span>{course.projectedPercent.toFixed(0)}% projected</span>
										</div>
									</article>
								{/each}
							{:else}
								<p class="empty-gradebook-note">No current courses match these filters.</p>
							{/if}
						</div>
					</div>
				{/if}

				{#if courseStatusFilter !== 'current'}
					<div class="transcript-column finished-column">
						<div class="transcript-column-head">
							<span>Finished courses</span>
							<strong>{filteredFinishedCourses.length}</strong>
						</div>
						<div class="transcript-list finished-course-grid">
							{#if filteredFinishedCourses.length > 0}
								{#each filteredFinishedCourses as course (course.id)}
									<button
										type="button"
										class="course-visual-card finished history-trigger"
										aria-label={`Open ${course.code} grade history`}
										onclick={() => openHistoryCourse(course.id)}
									>
										<div class="course-card-heading">
											<div>
												<strong>{course.code}</strong>
												<span>{course.name}</span>
											</div>
											<div class="course-score">
												<strong>{course.currentPercent.toFixed(0)}%</strong>
												<span
													>{course.letter} · {letterToGpa(course.letter)?.toFixed(2) ?? '--'} GPA</span
												>
											</div>
										</div>
										<div class="course-progress completed">
											<span style={`width: ${Math.min(100, course.currentPercent)}%`}></span>
										</div>
										<div class="course-card-meta">
											<span>{course.term}</span>
											<span>{course.historyGrades?.length ?? 0} detailed grade items</span>
											<span class="history-open-label">
												{course.historyGrades?.length ? 'Open gradebook' : 'View transcript note'}
											</span>
										</div>
									</button>
								{/each}
							{:else}
								<p class="empty-gradebook-note">No completed courses match these filters.</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</section>

		{#if hasAcademicProgressData}
			<section class="surface performance-panel" aria-label="Performance over time">
				<div class="performance-head">
					<div>
						<h2>Performance Trend</h2>
						<p>GPA by academic term</p>
					</div>
				</div>

				<div class="performance-body">
					<div class="performance-chart" role="img" aria-label="GPA trend bar chart">
						{#each performanceTrendWithDelta as item (item.term)}
							<div class="term-bar">
								<div class="term-bar-track">
									<span
										class={item.direction}
										style={`height: ${(item.gpa / gpaScaleMaximum) * 100}%`}
									></span>
								</div>
								<strong class={`trend-value ${item.direction}`}>
									{item.gpa.toFixed(2)}
								</strong>
								<small>{item.label}</small>
							</div>
						{/each}
					</div>

					<div class="performance-list">
						{#each performanceTrendWithDelta as item (item.term)}
							<div class="performance-row">
								<span>{item.label}</span>
								<span>{item.term}</span>
								<strong class={`trend-value ${item.direction}`}>
									{item.gpa.toFixed(2)}
									<span class="trend-change" aria-label={`GPA ${item.direction}`}>
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
							<h3>Course Results</h3>
							<p>{selectedPerformanceTerm} performance</p>
						</div>
						<label class="term-select-box">
							<span class="field-label">Term</span>
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
									<span>{course.code}</span>
									<strong>
										{course.status === 'finished'
											? `${course.letter} · ${letterToGpa(course.letter)?.toFixed(2) ?? '--'} GPA`
											: `Projected ${percentToLetter(course.projectedPercent)} · ${course.projectedPercent.toFixed(0)}%`}
									</strong>
								</div>
								<div class="course-bar-track">
									<span
										style={`width: ${Math.min(100, course.currentPercent)}%; background: ${gradeColor(course.currentPercent)}`}
									></span>
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
						<span class="gpa-kicker">Performance</span>
						<h2>No GPA trend yet</h2>
						<p class="empty-gradebook-note">
							Upload a transcript or import setup courses to generate academic progress analytics.
						</p>
					</div>
				</div>
			</section>
		{/if}
	{:else if courses.length === 0}
		<section class="surface empty-course-state" aria-label="No courses available">
			<h2>No course dashboard yet</h2>
			<p>
				Import courses during setup or upload a syllabus before course-specific grade analytics are
				shown here.
			</p>
		</section>
	{:else}
		<section class="surface course-link course-hero" aria-label="Current course overview">
			<div class="course-link-main">
				<div>
					<h2 class="course-link-title">
						<span class="course-code">{activeCourse.code}</span>
						{activeCourse.name}
					</h2>
				</div>
				<div class="course-link-meta">
					<span>{activeCourse.term}</span>
					<span>{activeCourse.instructor}</span>
				</div>
			</div>

			<div class="course-hero-side">
				<div class="course-select-box">
					<label class="field-label" for="course-select">Switch course</label>
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
			</div>
		</section>

		<section class="course-analytics" aria-label="Selected course grade analytics">
			<section class="course-facts" aria-label="Grade analytics overview">
				<div class="course-fact primary">
					<span class="fact-label">Current grade</span>
					<strong
						class="fact-value"
						style:color={hasGradeEntries ? gradeColor(currentAverage) : undefined}
						>{hasGradeEntries ? `${currentAverage.toFixed(1)}%` : '--'}</strong
					>
				</div>
				<div class="course-fact projected">
					<span class="fact-label">Projected grade</span>
					{#if hasGradeEntries}
						<strong class="fact-value" style:color={gradeColor(projectedFinal)}>
							{percentToLetter(projectedFinal)} · {projectedFinal.toFixed(1)}%
						</strong>
					{:else}
						<strong class="fact-value">--</strong>
					{/if}
				</div>
				<div class="course-fact final-target">
					<span class="fact-label">Needed on final</span>
					<strong class="fact-value {finalNeeded > 85 ? 'crit' : finalNeeded > 70 ? 'warn' : 'ok'}">
						{hasGradeEntries ? `${finalNeeded.toFixed(0)}%` : '--'}
					</strong>
				</div>
				<div class="course-fact categories">
					<span class="fact-label">Categories</span>
					<strong class="fact-value">{syllabusWeights.length}</strong>
				</div>
			</section>
		</section>

		<div class="digest-grid">
			<div class="grade-entry-column">
				<section class="surface import-panel" aria-label="Import grades">
					<div class="import-panel-head">
						<h2>Assignment</h2>
					</div>

					<div class="grade-form">
						<div class="assignment-row">
							<select bind:value={selectedCategory} aria-label="Assignment category">
								{#each syllabusWeights as item (item.category)}
									<option value={item.category}>{item.category} - {item.weight}%</option>
								{/each}
							</select>
							<input
								id="grade-label"
								bind:value={gradeLabel}
								placeholder="Quiz name"
								aria-label="Grade name"
							/>
							<div class="score-entry">
								<input
									bind:value={gradeScore}
									inputmode="decimal"
									placeholder="18"
									aria-label="Score"
								/>
								<span aria-hidden="true">/</span>
								<input
									bind:value={gradeMax}
									inputmode="decimal"
									placeholder="100"
									aria-label="Out of"
								/>
							</div>
						</div>
						<div class="form-actions">
							<button type="button" class="btn btn-primary" onclick={addGrade}>+ add grade</button>
							<button type="button" class="btn btn-secondary" onclick={importSampleGrades}>
								sample
							</button>
						</div>
					</div>
				</section>

				<section class="surface-polaroid gradebook">
					<SectionHead title="Gradebook" />
					<div class="gradebook-list">
						{#if gradeItems.length > 0}
							{#each gradeItems as item (item.id)}
								<div class="grade-row">
									<div class="grade-main">
										<span class="grade-category">{item.category}</span>
										<span class="grade-name">{item.label}</span>
									</div>
									<div class="grade-score">
										<span class="font-numeric">{item.score}/{item.max}</span>
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
							<div class="gradebook-empty">
								<strong>○ No grades yet</strong>
								<a class="btn btn-secondary" href="#grade-label">+ add grade</a>
							</div>
						{/if}
					</div>
				</section>
			</div>

			<section class="surface projection-panel">
				<div class="projection-heading">
					<h2>Grade Projection</h2>
				</div>
				<div class="projection-result">
					<span>Projected</span>
					<strong style:color={hasGradeEntries ? gradeColor(projectedFinal) : undefined}>
						{hasGradeEntries ? `${projectedFinal.toFixed(1)}%` : '--'}
					</strong>
					<small>{hasGradeEntries ? percentToLetter(projectedFinal) : 'Waiting for grades'}</small>
					<div class="projection-bar" aria-hidden="true">
						<span style={`width: ${hasGradeEntries ? Math.min(100, projectedFinal) : 0}%`}></span>
					</div>
				</div>
				<div class="target-box course-target-box">
					<div class="target-head">
						<label class="target-label" for="target-grade">Target grade</label>
						<span class="target-value">{targetGrade}%</span>
					</div>
					<input id="target-grade" type="range" min="50" max="100" bind:value={targetGrade} />
				</div>
				<div class="projection-note">
					{#if hasGradeEntries}
						<p>
							To finish with <strong>{percentToLetter(targetGrade)}</strong> ({targetGrade}%), aim
							for at least <strong>{finalNeeded.toFixed(1)}%</strong> on the final.
						</p>
						<p class="recommendation-detail">
							The final is worth {finalCategory?.weight ?? 0}% and currently has the greatest impact
							on this projection.
						</p>
					{:else}
						<div class="projection-empty">
							<strong>○ No grades yet</strong>
							<a class="btn btn-primary" href="#grade-label">+ add grade</a>
						</div>
					{/if}
				</div>

				<div class="projection-scale" role="img" aria-label="Projection scale">
					<div class="scale-line">
						{#if hasGradeEntries}
							<span style="left: {Math.min(100, currentAverage)}%"></span>
						{/if}
						<i style="left: {Math.min(100, targetGrade)}%"></i>
					</div>
					<div class="scale-labels">
						<span>current {hasGradeEntries ? `${currentAverage.toFixed(0)}%` : '--'}</span>
					</div>
				</div>

				<div class="weight-list">
					{#each categoryAnalytics as item (item.category)}
						<div class="weight-row">
							<div class="weight-copy compact">
								<span class="weight-name">{item.category}</span>
								<div class="weight-track" aria-label={`${item.category} is ${item.weight}%`}>
									<span style={`width: ${item.weight}%`}></span>
								</div>
							</div>
							<div class="weight-right">
								<span class="weight-num">{item.weight}%</span>
								<span class="status-chip {item.status}">
									{item.average === null ? 'Missing' : item.average.toFixed(0) + '%'}
								</span>
							</div>
						</div>
					{/each}
				</div>
			</section>
		</div>
	{/if}
</div>

<Dialog
	open={transcriptImportPromptOpen}
	onOpenChange={(open) => (transcriptImportPromptOpen = open)}
	title="Import courses from your transcript?"
	description="Synapse found semester and course information in the transcript you uploaded."
	class="transcript-import-dialog"
>
	{#if data.transcriptImportPreview}
		<div class="transcript-import-prompt">
			<p>
				We can add <strong
					>{data.transcriptImportPreview.courseCount} course{data.transcriptImportPreview
						.courseCount === 1
						? ''
						: 's'}</strong
				>
				{#if data.transcriptImportPreview.semesterCount > 0}
					and create <strong
						>{data.transcriptImportPreview.semesterCount} semester{data.transcriptImportPreview
							.semesterCount === 1
							? ''
							: 's'}</strong
					>
				{/if}
				in your academic database.
			</p>
			<ul aria-label="Detected transcript semesters">
				{#each data.transcriptImportPreview.terms as term (term)}
					<li>{term}</li>
				{/each}
			</ul>
			<p class="transcript-import-note">
				Existing courses with the same course code and semester will not be duplicated.
			</p>
			<div class="transcript-import-actions">
				<button
					type="button"
					class="btn btn-secondary"
					disabled={transcriptImporting}
					onclick={() => (transcriptImportPromptOpen = false)}>Not now</button
				>
				<button
					type="button"
					class="btn btn-primary"
					disabled={transcriptImporting}
					onclick={importTranscriptIntoSemesters}
				>
					{transcriptImporting ? 'Importing...' : 'Import semesters & courses'}
				</button>
			</div>
		</div>
	{/if}
</Dialog>

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
		<span class="gpa-kicker history-kicker">
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
						<span>{grade.category}</span>
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
		--dashboard-primary: var(--pen-blue);
		--dashboard-primary-soft: var(--paper-shelf);
		max-width: 1320px;
		margin-inline: auto;
		padding-block: 2rem 3rem;
	}

	.page:has(.gpa-panel) {
		display: block;
	}

	.page:has(.gpa-panel) .page-cover {
		order: 0;
	}

	.page:has(.gpa-panel) .digest-tabs {
		order: 1;
	}

	.page-cover {
		border-bottom: 0;
		padding-bottom: 0;
	}

	.transcript-import-prompt {
		display: grid;
		gap: 1rem;
	}

	.transcript-import-prompt p {
		margin: 0;
	}

	.transcript-import-prompt ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.transcript-import-prompt li {
		border: 1px solid var(--rule);
		background: var(--paper);
		padding: 0.35rem 0.6rem;
		font-family: var(--font-mono);
		font-size: var(--text-caption);
	}

	.transcript-import-note {
		color: var(--ink-soft);
		font-size: var(--text-small);
	}

	.transcript-import-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.transcript-import-success {
		margin: 0.75rem 0 0;
		color: var(--success, #26734d);
		font-size: var(--text-small);
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
		font-size: var(--text-caption);
		color: var(--ink-faint);
		text-transform: none;
		letter-spacing: normal;
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
		display: flex;
		gap: 1.75rem;
		margin: 0.85rem 0 1rem;
	}

	.digest-tabs button {
		display: block;
		border: 0;
		border-bottom: 1px solid var(--rule-soft);
		background: transparent;
		color: var(--ink);
		cursor: pointer;
		padding: 0.45rem 0.15rem;
		text-align: left;
	}

	.digest-tabs button.active {
		border-bottom: 2px solid var(--highlight);
		background: transparent;
		padding-bottom: calc(0.45rem - 1px);
	}

	.digest-tabs button:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.digest-tabs span {
		color: var(--ink-soft);
		font-size: var(--text-caption);
	}

	.digest-tabs strong {
		font-family: var(--font-body);
		font-size: var(--text-small);
		font-weight: 600;
		line-height: 1.2;
	}

	.performance-panel {
		margin: 0.75rem 0 1rem;
		border: 0;
		background: transparent;
	}

	.performance-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		padding: 0.55rem 0 0.35rem;
	}

	.performance-head h2 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 1.5rem;
		line-height: 1;
	}

	.performance-head p,
	.term-performance-head p {
		margin: 0.3rem 0 0;
		color: var(--ink-faint);
		font-size: var(--text-caption);
	}

	.performance-body {
		display: grid;
		grid-template-columns: minmax(22rem, 1.45fr) minmax(17rem, 0.75fr);
		gap: 1.25rem;
		margin-top: 0.6rem;
	}

	.performance-chart {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(3.75rem, 1fr));
		gap: 0.55rem;
		align-items: end;
		min-height: 13.5rem;
		background: var(--surface-paper);
		padding: 0.85rem 0.75rem 0.7rem;
		overflow: hidden;
	}

	.term-bar {
		display: grid;
		grid-template-rows: 1fr auto auto;
		gap: 0.25rem;
		align-items: end;
		height: 100%;
		min-width: 0;
		text-align: center;
	}

	.term-bar-track {
		position: relative;
		height: 8rem;
		background: color-mix(in srgb, var(--paper-shelf) 70%, var(--paper));
	}

	.term-bar-track span {
		position: absolute;
		inset-inline: 0;
		bottom: 0;
		background: var(--pen-blue);
	}

	.term-bar-track span.up {
		background: var(--pen-blue);
	}

	.term-bar-track span.down {
		background: var(--pen-blue);
	}

	.term-bar-track span.same {
		background: var(--pen-blue);
	}

	.term-bar strong {
		display: block;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: var(--text-small);
		line-height: 1;
		white-space: nowrap;
	}

	.term-bar small {
		color: var(--ink-faint);
		font-size: var(--text-caption);
		letter-spacing: 0;
	}

	.performance-list {
		display: grid;
		gap: 0;
		max-height: 13.5rem;
		overflow-y: auto;
		padding-right: 0.2rem;
		scrollbar-color: var(--ink-faint) var(--paper-shelf);
		scrollbar-width: thin;
	}

	.performance-row {
		display: grid;
		grid-template-columns: minmax(3rem, 0.4fr) minmax(7rem, 1fr) auto minmax(8rem, 1fr);
		gap: 0.55rem;
		align-items: center;
		border: 0;
		border-bottom: 1px solid var(--rule-soft);
		background: transparent;
		color: var(--ink-soft);
		font-size: var(--text-caption);
		padding: 0.55rem 0.35rem;
	}

	.performance-row:last-child {
		border-bottom: 0;
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

	.trend-change {
		display: inline-flex;
		gap: 0.15rem;
		align-items: center;
		font-family: var(--font-body);
		font-size: 0.65em;
		line-height: 1;
		white-space: nowrap;
	}

	.term-bar .trend-change {
		display: block;
		font-size: var(--text-caption);
	}

	/* Compact facts line that replaced the course-analytics index-bar strip. */
	.course-facts {
		display: flex;
		flex-wrap: wrap;
		border-block: 1px solid var(--rule);
		background: transparent;
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
		font-size: var(--text-caption);
		text-transform: none;
		letter-spacing: normal;
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

	.term-performance-panel {
		margin: 0.9rem 0 0.35rem;
		border: 0;
		border-top: 1px solid var(--rule-soft);
		background: transparent;
		padding: 0.85rem 0 0;
	}

	.term-performance-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
		padding-bottom: 0.55rem;
		border-bottom: 0;
	}

	.term-performance-head h3 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 1.3rem;
		line-height: 1;
	}

	.term-select-box {
		width: min(100%, 13rem);
		flex-shrink: 0;
	}

	.term-select-box select {
		border: 1px solid var(--rule);
	}

	.term-select-box .dropdown-arrow {
		border-color: var(--rule);
		background: transparent;
		color: var(--ink-faint);
	}

	.term-course-chart {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.45rem;
	}

	.term-course-bar {
		display: grid;
		grid-template-columns: minmax(8rem, 0.7fr) minmax(12rem, 1fr) auto;
		gap: 0.75rem;
		align-items: center;
		border: 0;
		border-bottom: 0;
		background: var(--paper-shelf);
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
		font-size: var(--text-caption);
	}

	.term-course-bar strong {
		color: var(--ink-soft);
		font-size: var(--text-caption);
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
		height: 0.55rem;
		border: 0;
		background: var(--paper-shelf);
	}

	.course-bar-track span {
		display: block;
		height: 100%;
		background: var(--dashboard-primary);
	}

	.course-link {
		display: flex;
		justify-content: space-between;
		gap: 1.5rem;
		align-items: center;
		margin: 0 0 0.8rem;
		border: 0;
		border-bottom: 1px solid var(--rule-soft);
		background: transparent;
		padding: 0.15rem 0 0.75rem;
	}

	.course-link-main {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.65rem;
		min-width: 0;
	}

	.course-link-title {
		display: grid;
		gap: 0.2rem;
		margin: 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 1.7rem;
		line-height: 1.1;
	}

	.course-code {
		color: var(--dashboard-primary);
		font-size: 1rem;
		text-transform: none;
		letter-spacing: normal;
	}

	.course-link-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.9rem;
	}

	.course-link-meta span {
		color: var(--ink-soft);
		font-size: var(--text-caption);
		padding: 0;
	}

	.course-select-box {
		width: min(100%, 20rem);
		flex-shrink: 0;
	}

	.course-hero-side {
		flex: 0 0 min(22rem, 42%);
	}

	.select-shell {
		position: relative;
	}

	.course-select-box select,
	.term-select-box select {
		width: 100%;
		min-height: 2.6rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: var(--text-small);
		padding: 0.55rem 2.2rem 0.55rem 0.65rem;
		appearance: none;
		cursor: pointer;
	}

	.dropdown-arrow {
		position: absolute;
		right: 0.7rem;
		top: 50%;
		width: 1rem;
		height: 1rem;
		transform: translateY(-50%);
		border: 0;
		background: transparent;
		color: var(--ink-faint);
		font-size: var(--text-caption);
		line-height: 1rem;
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
		grid-template-columns: 1fr;
		gap: 0.8rem;
		align-items: stretch;
		margin-bottom: 0.85rem;
		border: 0;
		background: transparent;
		padding: 0.15rem 0;
	}

	.gpa-panel > .gpa-facts {
		order: 2;
	}

	.gpa-panel > .gpa-hero,
	.gpa-panel > .upload-error,
	.gpa-panel > .transcript-import-success {
		order: 3;
	}

	.page:has(.gpa-panel) > .performance-panel {
		order: 4;
	}

	.gpa-panel > .dashboard-intelligence {
		order: 5;
	}

	.gpa-panel > .course-filter-bar {
		order: 6;
	}

	.gpa-panel > .transcript-columns {
		order: 7;
	}

	.gpa-hero {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		gap: 0.75rem;
		min-height: 2.7rem;
		border-bottom: 1px solid var(--rule-soft);
		padding: 0.15rem 0 0.65rem;
	}

	.gpa-scale-setting {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		color: var(--ink-faint);
		font-size: var(--text-caption);
	}

	.transcript-upload-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		align-items: center;
		justify-content: flex-start;
	}

	.transcript-upload-actions .btn,
	.gpa-scale-control {
		min-height: 2.6rem;
	}

	.gpa-scale-control {
		display: grid;
		width: 10.5rem;
		min-height: 0;
	}

	:global(.gpa-scale-trigger) {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		height: 2.7rem;
		border: 1px solid var(--rule);
		border-radius: 0;
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
		font: inherit;
		font-size: var(--text-caption);
		font-weight: 500;
		text-align: left;
		padding: 0.5rem 0.75rem 0.5rem 0.85rem;
		transition:
			border-color 120ms ease,
			background-color 120ms ease;
	}

	:global(.gpa-scale-trigger:hover),
	:global(.gpa-scale-trigger[data-state='open']) {
		background: var(--surface-paper);
	}

	:global(.gpa-scale-trigger:focus-visible) {
		border-color: var(--ink);
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	:global(.gpa-scale-chevron) {
		width: 0.48rem;
		height: 0.48rem;
		flex: 0 0 auto;
		border-right: 1px solid currentColor;
		border-bottom: 1px solid currentColor;
		color: var(--ink-faint);
		pointer-events: none;
		transform: translateY(-2px) rotate(45deg);
		transition: transform 120ms ease;
	}

	:global(.gpa-scale-trigger[data-state='open'] .gpa-scale-chevron) {
		transform: translateY(2px) rotate(225deg);
	}

	:global(.gpa-scale-menu) {
		z-index: var(--z-dropdown);
		min-width: var(--bits-select-trigger-width);
		overflow: hidden;
		border: 1px solid var(--rule);
		border-radius: 0;
		background: var(--paper);
		box-shadow: none;
	}

	:global(.gpa-scale-option) {
		min-height: 2.55rem;
		cursor: pointer;
		border-bottom: 1px dashed var(--rule);
		background: transparent;
		color: var(--ink);
		font-size: var(--text-caption);
		line-height: 1.35;
		outline: none;
		padding: 0.65rem 0.85rem;
	}

	:global(.gpa-scale-option:last-child) {
		border-bottom: 0;
	}

	:global(.gpa-scale-option[data-highlighted]) {
		background: var(--highlight-soft);
		box-shadow: inset 2px 0 0 var(--ink);
	}

	:global(.gpa-scale-option[data-selected]) {
		background: transparent;
		color: var(--ink);
		box-shadow: inset 2px 0 0 var(--ink);
		font-weight: 600;
	}

	:global(.gpa-scale-option[data-highlighted]) {
		background: var(--highlight);
		font-weight: 500;
	}

	:global(.gpa-scale-option[data-selected][data-highlighted]) {
		background: var(--highlight);
		font-weight: 600;
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
		font-size: var(--text-caption);
		text-transform: none;
		letter-spacing: normal;
	}

	.upload-error {
		margin: 0;
		color: var(--accent);
		font-size: var(--text-caption);
		text-transform: none;
		letter-spacing: normal;
	}

	.page-subtitle-label {
		font-family: var(--font-body);
		font-size: var(--text-small);
		color: var(--ink-soft);
	}

	.source-label {
		font-family: var(--font-body);
		font-size: var(--text-small);
		color: var(--ink-soft);
		display: block;
		margin-bottom: 0.25rem;
	}

	.gpa-facts {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) repeat(2, minmax(0, 0.75fr));
		gap: 0.65rem;
		margin: 0;
		border: 0;
	}

	.gpa-facts > div {
		display: flex;
		min-height: 6.6rem;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 0.45rem;
		border: 0;
		background: var(--paper-shelf);
		padding: 0.95rem 1rem;
		text-align: center;
	}

	.gpa-facts > .gpa-fact-primary {
		grid-column: auto;
		min-height: 8rem;
		background: color-mix(in srgb, var(--ok) 10%, var(--paper));
		padding-block: 0.95rem;
	}

	.gpa-facts > .gpa-fact-trend {
		background: var(--paper-shelf);
	}

	.gpa-facts > .gpa-fact-credits {
		background: color-mix(in srgb, var(--pen-blue) 8%, var(--paper));
	}

	.gpa-facts > .gpa-fact-credits dd {
		color: var(--pen-blue);
	}

	.gpa-facts > .gpa-fact-primary dd {
		color: var(--ok);
	}

	.gpa-facts dt {
		font-family: var(--font-body);
		font-size: var(--text-small);
		font-weight: 600;
		text-transform: none;
		letter-spacing: normal;
		color: var(--ink-faint);
	}

	.gpa-facts dd {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.25rem 0.4rem;
		align-items: baseline;
		margin: 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 700;
		font-size: clamp(1.8rem, 3vw, 2.35rem);
		line-height: 1;
	}

	.gpa-facts .gpa-fact-primary dd {
		font-size: clamp(2.8rem, 5vw, 4.25rem);
	}

	.gpa-facts .gpa-fact-primary dt {
		font-size: var(--text-body);
	}

	.gpa-facts dd span {
		flex-basis: auto;
		color: var(--ink-soft);
		font-size: 0.7rem;
		font-weight: 500;
	}

	.gpa-facts > div:last-child dd span:not(.metric-unit) {
		flex-basis: 100%;
	}

	.gpa-facts dd .gpa-value-unit {
		flex-basis: auto;
		color: var(--ink-soft);
		font-size: var(--text-small);
		font-weight: 600;
	}

	.gpa-facts dd .movement-unit {
		flex-basis: auto;
		font-size: var(--text-caption);
		font-weight: 600;
	}

	.hero-gpa-support {
		display: none;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.55rem 1.5rem;
		color: var(--ink-soft);
		font-size: var(--text-small);
	}

	.hero-gpa-support .up {
		color: var(--ok);
	}

	.hero-gpa-support .down {
		color: var(--accent);
	}

	.dashboard-intelligence {
		display: none;
		grid-template-columns: minmax(0, 2fr) minmax(17rem, 0.65fr);
		gap: 1rem;
		margin-top: 0.4rem;
	}

	.insight-panel,
	.goal-panel {
		background: var(--paper-shelf);
		padding: 1.25rem 1.35rem;
	}

	.insight-panel {
		border-left: 2px solid var(--highlight);
		background: color-mix(in srgb, var(--highlight) 5%, var(--paper-edge));
		padding: 1.5rem 1.65rem;
	}

	.intelligence-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.intelligence-heading span {
		color: var(--ink-faint);
		font-size: var(--text-caption);
	}

	.intelligence-heading h2 {
		margin: 0.2rem 0 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 1.5rem;
		line-height: 1;
	}

	.intelligence-heading > strong {
		color: var(--ok);
		font-family: var(--font-body);
		font-size: 1.4rem;
		line-height: 1;
	}

	.insight-panel ul {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem 1.5rem;
		margin: 1.1rem 0 0;
		padding: 0;
		list-style: none;
	}

	.insight-panel li {
		display: flex;
		gap: 0.55rem;
		align-items: flex-start;
		color: var(--ink-soft);
		font-size: var(--text-small);
		line-height: 1.45;
	}

	.insight-panel li::before {
		position: absolute;
		left: 0;
		color: var(--ink-faint);
		content: '•';
	}

	.goal-values {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 0.8rem;
	}

	.insight-panel li::before {
		content: none;
	}

	.insight-symbol {
		flex: 0 0 auto;
		color: var(--highlight);
	}

	.goal-values div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.goal-values span,
	.goal-control > span {
		color: var(--ink-faint);
		font-size: var(--text-caption);
	}

	.goal-values strong {
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 1.1rem;
	}

	.goal-progress {
		height: 0.55rem;
		margin-top: 0.75rem;
		background: color-mix(in srgb, var(--dashboard-primary) 12%, var(--paper));
	}

	.goal-progress > span {
		display: block;
		height: 100%;
		background: var(--dashboard-primary);
	}

	.goal-control {
		display: grid;
		gap: 0.25rem;
		margin-top: 0.65rem;
	}

	.goal-control input {
		width: 100%;
		accent-color: var(--dashboard-primary);
	}

	.course-filter-bar {
		display: none;
		grid-template-columns: minmax(15rem, 1fr) minmax(10rem, 0.35fr) minmax(10rem, 0.35fr);
		gap: 0.65rem;
		align-items: end;
		margin-top: 1rem;
	}

	.course-filter-bar label {
		display: grid;
		gap: 0.3rem;
	}

	.course-filter-bar label > span {
		color: var(--ink-faint);
		font-size: var(--text-caption);
	}

	.course-filter-bar input,
	.course-filter-bar select {
		width: 100%;
		min-height: 2.5rem;
		border: 1px solid var(--rule);
		border-radius: 0;
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: var(--text-caption);
		padding: 0.5rem 0.65rem;
	}

	.gpa-facts .metric-note {
		max-width: 15rem;
		color: var(--ink-faint);
		font-size: 0.7rem;
		line-height: 1.35;
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

	.transcript-columns {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
		padding-top: 0.35rem;
	}

	.transcript-column {
		min-width: 0;
		border: 0;
		background: transparent;
		padding: 0.15rem 0;
	}

	.transcript-column + .transcript-column {
		margin-top: 0.25rem;
		border-top: 1px solid var(--rule-soft);
		padding-top: 0.75rem;
	}

	.transcript-column-head {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		color: var(--ink-faint);
		font-size: var(--text-caption);
		text-transform: none;
		letter-spacing: 0.1em;
		padding-bottom: 0.45rem;
	}

	.current-column .transcript-column-head span {
		color: var(--ink-faint);
		font-family: inherit;
		font-size: var(--text-caption);
		font-weight: 400;
		letter-spacing: 0.1em;
	}

	.finished-column .transcript-column-head span {
		color: var(--ink-faint);
		font-size: var(--text-caption);
		font-weight: 400;
		letter-spacing: 0.1em;
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
		max-height: min(42vh, 20rem);
		overflow-y: auto;
		overscroll-behavior: contain;
		margin-top: 0.45rem;
		padding-right: 0.35rem;
		scrollbar-color: var(--ink-faint) var(--paper-shelf);
		scrollbar-width: thin;
	}

	.current-course-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		overflow: visible;
		max-height: none;
	}

	.finished-course-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.course-visual-card {
		display: grid;
		gap: 0.65rem;
		width: 100%;
		min-width: 0;
		border: 0;
		border-left: 0;
		border-radius: 0;
		background: var(--paper-shelf);
		color: var(--ink);
		font: inherit;
		padding: 0.8rem 0.9rem;
		text-align: left;
	}

	.course-visual-card.finished {
		background: color-mix(in srgb, var(--pen-blue) 5%, var(--paper));
		gap: 0.65rem;
		padding: 0.8rem 0.9rem;
	}

	.course-visual-card.current {
		gap: 0.65rem;
		background: color-mix(in srgb, #d4a72c 7%, var(--paper));
		padding: 0.8rem 0.9rem;
	}

	.course-card-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.course-card-heading > div:first-child {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
	}

	.course-card-heading > div:first-child strong {
		color: var(--ink);
		font-family: var(--font-body);
		font-size: var(--text-small);
	}

	.course-card-heading > div:first-child span {
		overflow: hidden;
		color: var(--ink-soft);
		font-size: var(--text-caption);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.course-score {
		display: grid;
		flex: 0 0 auto;
		gap: 0.15rem;
		text-align: right;
	}

	.course-score strong {
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 1.45rem;
		line-height: 1;
	}

	.course-score span {
		color: var(--ink-faint);
		font-size: 0.68rem;
	}

	.course-visual-card.current .course-score strong {
		font-size: 1.45rem;
	}

	.course-visual-card.finished .course-score strong {
		font-size: 1.45rem;
	}

	.course-progress {
		height: 0.4rem;
		background: color-mix(in srgb, var(--dashboard-primary) 12%, var(--paper));
	}

	.course-progress span {
		display: block;
		height: 100%;
		background: #b28718;
	}

	.course-progress.completed {
		height: 0.4rem;
		background: color-mix(in srgb, var(--dashboard-primary) 12%, var(--paper));
	}

	.course-progress.completed span {
		background: var(--pen-blue);
	}

	.course-card-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		color: var(--ink-faint);
		font-size: 0.68rem;
	}

	.history-trigger {
		cursor: pointer;
		transition:
			background 0.12s var(--ease-out-quart),
			transform 0.12s var(--ease-out-quart);
	}

	.history-trigger:hover {
		background: color-mix(in srgb, var(--pen-blue) 3%, var(--paper));
		transform: translateX(2px);
	}

	.history-open-label {
		color: var(--ink-soft);
		font-size: var(--text-caption);
		text-transform: none;
		letter-spacing: normal;
	}

	.history-trigger:hover .history-open-label {
		color: var(--ink-soft);
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
		font-size: var(--text-caption);
	}

	.history-modal-meta strong {
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: var(--text-small);
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
		font-size: var(--text-caption);
		padding: 0.5rem 0.6rem;
	}

	.history-grade-item strong {
		color: var(--ink);
		font-family: var(--font-body);
		font-size: var(--text-caption);
	}

	.history-empty-note,
	.empty-gradebook-note {
		margin: 0;
		border: 1px dashed var(--ink-faint);
		background: var(--paper-shelf);
		color: var(--ink-soft);
		font-size: var(--text-caption);
		line-height: 1.5;
		padding: 0.8rem;
	}

	.course-analytics {
		margin-bottom: 1rem;
	}

	.empty-course-state {
		margin-top: 1rem;
		padding: 1.25rem;
	}

	.empty-course-state h2 {
		margin: 0.35rem 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 1.8rem;
	}

	.empty-course-state p {
		margin: 0;
		color: var(--ink-soft);
		line-height: 1.5;
	}

	.course-analytics .course-facts {
		display: grid;
		grid-template-columns: 1.35fr repeat(3, minmax(0, 1fr));
		gap: 0.7rem;
		margin-top: 0;
		border: 0;
		padding: 0;
	}

	.course-analytics .course-fact {
		min-height: 7.5rem;
		align-content: center;
		gap: 0.35rem;
		border: 0;
		background: var(--paper-shelf);
		padding: 1rem;
	}

	.course-analytics .course-fact.primary {
		background: color-mix(in srgb, var(--ok) 10%, var(--paper));
	}

	.course-analytics .course-fact.projected {
		background: var(--paper-shelf);
	}

	.course-analytics .course-fact.final-target {
		background: color-mix(in srgb, var(--warn) 7%, var(--paper));
	}

	.course-analytics .course-fact.categories {
		background: color-mix(in srgb, var(--pen-blue) 8%, var(--paper));
	}

	.course-analytics .course-fact.categories .fact-value {
		color: var(--pen-blue);
	}

	.course-analytics .fact-value {
		font-size: 2rem;
		line-height: 1;
	}

	.course-analytics .course-fact.primary .fact-value {
		font-size: 2.75rem;
	}

	.panel-copy {
		margin: 1rem 0;
		color: var(--ink-soft);
		font-size: var(--text-small);
		line-height: 1.55;
	}

	.import-panel {
		border: 0;
		background: var(--paper-shelf);
		padding: 1rem;
	}

	.digest-grid {
		grid-template-columns: minmax(16rem, 0.72fr) minmax(24rem, 1.28fr);
		gap: 1rem;
		align-items: start;
	}

	.grade-entry-column {
		display: grid;
		gap: 0.75rem;
		align-self: start;
	}

	.projection-panel,
	.gradebook {
		border: 0;
		background: var(--paper-shelf);
		box-shadow: none;
		transform: none;
	}

	.projection-panel {
		padding: 1rem 1.15rem;
	}

	.import-panel-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		padding-bottom: 0.65rem;
		border-bottom: 0;
	}

	.import-panel-head h2 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 1.75rem;
		line-height: 1;
	}

	.grade-form {
		display: grid;
		gap: 0.7rem;
		margin-top: 0.75rem;
	}

	.grade-form input,
	.grade-form select {
		width: 100%;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: var(--text-small);
		padding: 0.55rem 0.65rem;
	}

	.assignment-row {
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) minmax(8rem, 1fr) minmax(9rem, 0.85fr);
		gap: 0.55rem;
	}

	.score-entry {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 0.35rem;
	}

	.score-entry span {
		color: var(--ink-faint);
		text-align: center;
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
		margin: 0.9rem 0 1.1rem;
		padding: 0.9rem 1rem;
		border: 0;
		border-left: 3px solid var(--dashboard-primary);
		background: color-mix(in srgb, var(--dashboard-primary) 7%, var(--paper));
		color: var(--ink);
	}

	.course-target-box {
		width: 100%;
		margin-top: 0.9rem;
	}

	.projection-note p {
		margin: 0;
		font-size: var(--text-small);
		line-height: 1.55;
	}

	.projection-note .recommendation-detail {
		margin-top: 0.45rem;
		color: var(--ink-soft);
		font-size: var(--text-caption);
	}

	.projection-heading h2 {
		margin: 0.15rem 0 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 1.7rem;
		line-height: 1.1;
	}

	.projection-result {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: 0.15rem 1rem;
		margin-top: 1rem;
		padding: 0.9rem 0;
	}

	.projection-result > span {
		color: var(--ink-soft);
		font-size: var(--text-small);
	}

	.projection-result strong {
		grid-row: 1 / span 2;
		grid-column: 2;
		font-family: var(--font-body);
		font-size: 3rem;
		line-height: 0.95;
	}

	.projection-result small {
		color: var(--ink);
		font-size: 1rem;
		font-weight: 600;
	}

	.projection-bar {
		grid-column: 1 / -1;
		height: 0.45rem;
		margin-top: 0.45rem;
		background: color-mix(in srgb, var(--pen-blue) 10%, var(--paper));
	}

	.projection-bar span {
		display: block;
		height: 100%;
		background: var(--pen-blue);
	}

	.projection-empty,
	.gradebook-empty {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.projection-empty > strong,
	.gradebook-empty > strong {
		flex: 1;
		color: var(--ink-soft);
		font-size: var(--text-small);
		font-weight: 500;
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
	.scale-line i {
		position: absolute;
		top: -0.35rem;
		width: 0.15rem;
		height: 1.1rem;
		background: var(--ink);
	}

	.scale-line i {
		background: var(--accent);
	}

	.scale-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.5rem;
		color: var(--ink-faint);
		font-size: var(--text-caption);
		text-transform: none;
		letter-spacing: normal;
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

	.weight-copy {
		flex: 1;
		min-width: 0;
	}

	.weight-copy.compact {
		display: grid;
		grid-template-columns: minmax(7rem, 0.45fr) minmax(8rem, 1fr);
		align-items: center;
		gap: 0.75rem;
	}

	.weight-track {
		width: 100%;
		height: 0.35rem;
		background: var(--paper-shelf);
	}

	.weight-track span {
		display: block;
		height: 100%;
		background: var(--pen-blue);
	}

	.weight-row:last-child,
	.grade-row:last-child {
		border-bottom: 0;
	}

	.weight-name,
	.grade-name {
		display: block;
		color: var(--ink);
		font-size: var(--text-small);
		font-weight: 500;
	}

	.grade-category {
		display: block;
		color: var(--ink-faint);
		font-size: var(--text-caption);
		text-transform: none;
		letter-spacing: normal;
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
		font-size: var(--text-caption);
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
		margin-top: 0;
		border-top: 1px solid var(--rule-soft);
		background: transparent;
		padding: 0.9rem 0;
	}

	.grade-main {
		min-width: 0;
	}

	.grade-score {
		color: var(--ink);
		font-size: var(--text-small);
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

		.performance-body,
		.term-course-bar,
		.transcript-columns {
			grid-template-columns: 1fr;
		}

		.transcript-column + .transcript-column {
			border-left: 0;
			padding-left: 0;
		}
	}

	@media (max-width: 900px) {
		.digest-grid {
			grid-template-columns: 1fr;
		}

		.gpa-hero {
			align-items: flex-start;
			flex-direction: column;
		}

		.transcript-upload-actions {
			justify-content: flex-start;
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

		.course-hero-side {
			width: 100%;
			flex-basis: auto;
		}

		.course-link-actions {
			justify-content: flex-start;
		}

		.course-analytics .course-facts {
			grid-template-columns: repeat(2, minmax(0, 1fr));
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

		.term-performance-head {
			display: grid;
		}

		.dashboard-intelligence,
		.course-filter-bar {
			grid-template-columns: 1fr;
		}

		.insight-panel ul {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.digest-tabs {
			grid-template-columns: 1fr;
		}

		.gpa-facts {
			grid-template-columns: 1fr;
		}

		.gpa-facts > div {
			border: 0;
		}

		.course-analytics .course-facts {
			grid-template-columns: 1fr;
		}

		.projection-empty,
		.gradebook-empty {
			align-items: flex-start;
			flex-wrap: wrap;
		}

		.transcript-upload-actions,
		.transcript-upload-actions .btn,
		.gpa-scale-control {
			width: 100%;
		}

		.weight-row,
		.grade-row {
			flex-direction: column;
			align-items: flex-start;
		}

		.assignment-row,
		.history-grade-item,
		.performance-row {
			grid-template-columns: 1fr;
		}

		.current-course-grid,
		.finished-course-grid {
			grid-template-columns: 1fr;
		}

		.history-modal-meta {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
