type SidebarHref =
	| '/app'
	| '/app/courses'
	| '/app/courses/manage'
	| '/app/calendar'
	| '/app/timer'
	| '/app/chat'
	| '/app/brief'
	| '/app/digest'
	| '/app/syllabus'
	| '/app/activity';

export interface SidebarRoute {
	href: SidebarHref;
	label: string;
	icon?: string;
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
	{ href: '/app', label: 'Dashboard' },
	{ href: '/app/courses', label: 'Course map' },
	{ href: '/app/calendar', label: 'Calendar' },
	{ href: '/app/timer', label: 'Study Timer' },
	{ href: '/app/chat', label: 'Assistant' },
	{ href: '/app/digest', label: 'Grade analytics' },
	{ href: '/app/syllabus', label: 'Syllabus parser' },
	{ href: '/app/brief', label: 'Research' },
	{ href: '/app/activity', label: 'Activity' }
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
