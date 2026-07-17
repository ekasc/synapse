export type MapCourse = {
	id: string;
	semesterId: string;
	code: string;
	name: string;
};

export type MapSemester = {
	id: string;
	term: string;
	year: number;
	order: number;
};

export type MapRelation = {
	id: string;
	source: string;
	target: string;
	type: string;
	reviewStatus?: 'accepted' | 'pending' | 'rejected';
};

export type MapPosition = {
	x: number;
	y: number;
	width: number;
	height: number;
};
