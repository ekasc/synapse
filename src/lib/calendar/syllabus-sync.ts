export type ParsedSyllabusDate = { month: number; day: number; year?: number };

const MONTHS: Record<string, number> = {
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	may: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11
};

function validDate(year: number, month: number, day: number): boolean {
	const date = new Date(year, month, day);
	return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
}

export function parseSyllabusCalendarDate(value: string): ParsedSyllabusDate | null {
	const text = value.trim();
	const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (iso) {
		const year = Number(iso[1]);
		const month = Number(iso[2]) - 1;
		const day = Number(iso[3]);
		return validDate(year, month, day) ? { year, month, day } : null;
	}

	const named = text.match(/^([a-zA-Z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
	if (!named) return null;
	const month = MONTHS[named[1].toLowerCase().slice(0, 3)];
	const day = Number(named[2]);
	const year = named[3] ? Number(named[3]) : undefined;
	if (month === undefined || !validDate(year ?? 2000, month, day)) return null;
	return year === undefined ? { month, day } : { year, month, day };
}
