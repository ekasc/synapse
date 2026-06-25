import { json } from '@sveltejs/kit';
import { getSyllabusImport, mockExtractSyllabus } from '$lib/server/store';

export function GET() {
	return json(getSyllabusImport() ?? mockExtractSyllabus());
}
