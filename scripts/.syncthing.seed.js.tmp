// Seed script: populates the data store with 4 semesters of courses.
// Run with: node scripts/seed.js from project root (after pnpm install)
// Or just copy the .data/*.json files directly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '.data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const semesters = [
	{ id: 'f25', term: 'Fall', year: 2025, order: 20251 },
	{ id: 's26', term: 'Spring', year: 2026, order: 20262 },
	{ id: 'f26', term: 'Fall', year: 2026, order: 20263 },
	{ id: 's27', term: 'Spring', year: 2027, order: 20274 },
];

const courses = [
	// Fall 2025
	{ id: 'c01', semesterId: 'f25', code: 'COMP 1110', name: 'Intro to Programming' },
	{ id: 'c02', semesterId: 'f25', code: 'MATH 1120', name: 'Calculus I' },
	{ id: 'c03', semesterId: 'f25', code: 'ENGL 1101', name: 'Academic Writing' },
	{ id: 'c04', semesterId: 'f25', code: 'CSIS 1100', name: 'Foundations of IS' },
	// Spring 2026
	{ id: 'c05', semesterId: 's26', code: 'COMP 2110', name: 'Data Structures' },
	{ id: 'c06', semesterId: 's26', code: 'MATH 1130', name: 'Calculus II' },
	{ id: 'c07', semesterId: 's26', code: 'STAT 2160', name: 'Statistics' },
	{ id: 'c08', semesterId: 's26', code: 'CSIS 2100', name: 'Systems Analysis' },
	// Fall 2026
	{ id: 'c09', semesterId: 'f26', code: 'COMP 2120', name: 'Discrete Structures' },
	{ id: 'c10', semesterId: 'f26', code: 'CSIS 3100', name: 'Algorithms' },
	{ id: 'c11', semesterId: 'f26', code: 'ECON 2200', name: 'Principles of Econ' },
	{ id: 'c12', semesterId: 'f26', code: 'ISYS 3300', name: 'IT Project Mgmt' },
	// Spring 2027
	{ id: 'c13', semesterId: 's27', code: 'CSIS 4495', name: 'Capstone Project' },
	{ id: 'c14', semesterId: 's27', code: 'CSIS 4500', name: 'Cybersecurity' },
	{ id: 'c15', semesterId: 's27', code: 'CSIS 4400', name: 'Machine Learning' },
	{ id: 'c16', semesterId: 's27', code: 'HUMN 1101', name: 'Humanities Elective' },
];

fs.writeFileSync(path.join(DATA_DIR, 'semesters.json'), JSON.stringify(semesters, null, '\t'));
fs.writeFileSync(path.join(DATA_DIR, 'courses.json'), JSON.stringify(courses, null, '\t'));

console.log(`Seeded ${semesters.length} semesters and ${courses.length} courses.`);
