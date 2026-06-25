import { describe, expect, it } from 'vitest';
import { normalizeRelation, toFlowEdges, toFlowNodes, toPersistedGraph } from './graph';
import type { Course, CourseFlowEdge, CourseFlowNode, Semester } from './types';

const course: Course = {
	id: 'course-1',
	semesterId: 'semester-1',
	code: 'CSIS 1000',
	name: 'Foundations'
};

const semester: Semester = {
	id: 'semester-1',
	term: 'Fall',
	year: 2026,
	order: 1
};

describe('graph normalization', () => {
	it('uses a deterministic ID for persisted relations without one', () => {
		const relation = { source: 'course-1', target: 'course-2', type: 'prereq' as const };

		expect(normalizeRelation(relation).id).toBe('course-1:course-2:prereq');
		expect(normalizeRelation(relation).id).toBe(normalizeRelation(relation).id);
	});

	it('drops self-links, missing endpoints, and duplicate relations', () => {
		const edges = toFlowEdges(
			[
				{ source: 'course-1', target: 'course-1', type: 'related' },
				{ source: '', target: 'course-2', type: 'related' },
				{ source: 'course-1', target: 'course-2', type: 'related' },
				{ source: 'course-1', target: 'course-2', type: 'related', id: 'duplicate' }
			],
			new Set(['course-1', 'course-2'])
		);

		expect(edges).toHaveLength(1);
	});

	it('replaces non-finite persisted positions with a safe default', () => {
		const nodes = toFlowNodes(
			[course],
			{ [semester.id]: semester },
			{ [course.id]: { x: Number.NaN, y: Number.POSITIVE_INFINITY } }
		);

		expect(nodes[0].position).toEqual({ x: 120, y: 120 });
	});

	it('does not persist non-finite node positions', () => {
		const node = {
			id: course.id,
			type: 'course',
			position: { x: Number.NaN, y: 10 },
			data: {
				course,
				semesterLabel: 'Fall 2026',
				tagColor: '#fff'
			}
		} as CourseFlowNode;

		const state = toPersistedGraph([node], [] as CourseFlowEdge[], { x: 0, y: 0, zoom: 1 });

		expect(state.positions).toEqual({});
	});
});
