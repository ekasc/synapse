import type { MapCourse, MapPosition, MapSemester } from './types';

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 96;
export const COLUMN_GAP = 140;
export const ROW_GAP = 32;
export const CANVAS_PADDING = 48;
export const SEMESTER_HEADING_HEIGHT = 56;

export type StaticLayout = {
	width: number;
	height: number;
	positions: Record<string, MapPosition>;
};

export function getOrderedColumns(courses: MapCourse[], semesters: MapSemester[]) {
	const orderedSemesters = [...semesters].sort(
		(a, b) => a.order - b.order || a.id.localeCompare(b.id)
	);
	const semesterIds = new Set(semesters.map((semester) => semester.id));
	const hasUnplaced = courses.some((course) => !semesterIds.has(course.semesterId));
	return [
		...orderedSemesters.map((semester) => ({
			id: semester.id,
			label: `${semester.term} ${semester.year}`
		})),
		...(hasUnplaced ? [{ id: '__unplaced__', label: 'Unplaced' }] : [])
	];
}

export function createStaticLayout(courses: MapCourse[], semesters: MapSemester[]): StaticLayout {
	const columns = getOrderedColumns(courses, semesters);
	const semesterIds = new Set(semesters.map((semester) => semester.id));
	const grouped = new Map(columns.map((column) => [column.id, [] as MapCourse[]]));

	for (const course of courses) {
		const columnId = semesterIds.has(course.semesterId) ? course.semesterId : '__unplaced__';
		grouped.get(columnId)?.push(course);
	}

	const positions: Record<string, MapPosition> = {};
	let maxRows = 0;
	columns.forEach((column, columnIndex) => {
		const columnCourses = grouped.get(column.id) ?? [];
		columnCourses.sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id));
		maxRows = Math.max(maxRows, columnCourses.length);
		columnCourses.forEach((course, courseIndex) => {
			positions[course.id] = {
				x: CANVAS_PADDING + columnIndex * (NODE_WIDTH + COLUMN_GAP),
				y: SEMESTER_HEADING_HEIGHT + CANVAS_PADDING + courseIndex * (NODE_HEIGHT + ROW_GAP),
				width: NODE_WIDTH,
				height: NODE_HEIGHT
			};
		});
	});

	const width = Math.max(
		2 * CANVAS_PADDING,
		2 * CANVAS_PADDING + columns.length * NODE_WIDTH + Math.max(0, columns.length - 1) * COLUMN_GAP
	);
	const height = Math.max(
		SEMESTER_HEADING_HEIGHT + 2 * CANVAS_PADDING,
		SEMESTER_HEADING_HEIGHT +
			2 * CANVAS_PADDING +
			maxRows * NODE_HEIGHT +
			Math.max(0, maxRows - 1) * ROW_GAP
	);
	return { width, height, positions };
}
