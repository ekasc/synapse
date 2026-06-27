import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Force the store to use a per-test data directory by overriding process.cwd.
// Imported AFTER setup so the module's path.resolve('.data') binds to the new cwd.
const testDir = mkdtempSync(join(tmpdir(), 'synapse-store-'));
process.chdir(testDir);

const { addCourse, getCourses, updateCourse, deleteCourse, sanitizeCourseColor } =
	await import('./store');

beforeEach(() => {
	rmSync(join(testDir, '.data'), { recursive: true, force: true });
});

describe('sanitizeCourseColor', () => {
	it('accepts 3-, 6-, and 8-digit hex colors', () => {
		expect(sanitizeCourseColor('#fff')).toBe('#fff');
		expect(sanitizeCourseColor('#FFFFFF')).toBe('#FFFFFF');
		expect(sanitizeCourseColor('#1a1814ff')).toBe('#1a1814ff');
	});

	it('strips whitespace around valid values', () => {
		expect(sanitizeCourseColor('  #abc  ')).toBe('#abc');
	});

	it('rejects CSS injection attempts with semicolons or parens', () => {
		expect(sanitizeCourseColor('red; background: url(http://evil)')).toBeUndefined();
		expect(sanitizeCourseColor('rgb(1,2,3)')).toBeUndefined();
		expect(sanitizeCourseColor('hsl(0 0% 0%)')).toBeUndefined();
	});

	it('rejects quoted-value breakouts and non-string input', () => {
		expect(sanitizeCourseColor('foo"bar')).toBeUndefined();
		expect(sanitizeCourseColor("'; display:none")).toBeUndefined();
		expect(sanitizeCourseColor(null)).toBeUndefined();
		expect(sanitizeCourseColor(undefined)).toBeUndefined();
		expect(sanitizeCourseColor(0xffffff)).toBeUndefined();
	});
});

describe('addCourse / updateCourse color sanitization', () => {
	const base = {
		id: 'c1',
		semesterId: 's1',
		code: 'CSIS 1000',
		name: 'Foundations'
	};

	it('strips a malicious color on add', () => {
		addCourse({ ...base, color: 'red; background: url(http://evil)' });
		expect(getCourses()[0]?.color).toBeUndefined();
	});

	it('strips a malicious color on update', () => {
		addCourse({ ...base });
		updateCourse('c1', { color: '#fff; color: red' });
		expect(getCourses()[0]?.color).toBeUndefined();
	});

	it('keeps a valid hex color on update', () => {
		addCourse({ ...base });
		updateCourse('c1', { color: '#4a6fa5' });
		expect(getCourses()[0]?.color).toBe('#4a6fa5');
	});

	it('clears the color when an invalid value is sent', () => {
		addCourse({ ...base, color: '#fff' });
		updateCourse('c1', { color: 'red; bad' });
		expect(getCourses()[0]?.color).toBeUndefined();
	});

	it('survives a delete without resurrecting the bad color', () => {
		addCourse({ ...base, color: 'red; bad' });
		deleteCourse('c1');
		expect(getCourses()).toHaveLength(0);
	});
});
