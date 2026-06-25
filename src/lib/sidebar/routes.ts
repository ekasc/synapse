type SidebarHref =
	| '/app'
	| '/app/courses'
	| '/app/courses/manage'
	| '/app/calendar'
	| '/app/digest'
	| '/app/practice'
	| '/app/brief'
	| '/app/syllabus';

export interface SidebarRoute {
	href: SidebarHref;
	label: string;
	icon: string;
	match?: (pathname: string, href: string) => boolean;
	external?: boolean;
	badge?: number;
	children?: SidebarChildRoute[];
}

export interface SidebarChildRoute {
	href: SidebarHref;
	label: string;
	match?: (pathname: string, href: string) => boolean;
}

export const routes: SidebarRoute[] = [
	{ href: '/app', label: 'Dashboard', icon: 'dashboard' },
	{
		href: '/app/courses',
		label: 'Courses',
		icon: 'courses',
		children: [
			{ href: '/app/courses/manage', label: 'manage', match: (p) => p === '/app/courses/manage' },
			{ href: '/app/courses', label: 'graph', match: (p) => p === '/app/courses' }
		]
	},
	{ href: '/app/calendar', label: 'Calendar', icon: 'calendar' },
	{ href: '/app/digest', label: 'Digest', icon: 'digest' },
	{ href: '/app/practice', label: 'Practice', icon: 'practice' },
	{ href: '/app/brief', label: 'Brief', icon: 'brief' },
	{ href: '/app/syllabus', label: 'Syllabus', icon: 'syllabus' }
];

export function isRouteActive(pathname: string, route: SidebarRoute): boolean {
	if (route.match) return route.match(pathname, route.href);
	if (route.href === '/app') return pathname === '/app';
	return pathname === route.href || pathname.startsWith(route.href + '/');
}

export function isChildActive(pathname: string, child: SidebarChildRoute): boolean {
	if (child.match) return child.match(pathname, child.href);
	return pathname === child.href;
}
