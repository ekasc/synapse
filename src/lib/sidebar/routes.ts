type SidebarHref =
	| '/app'
	| '/app/courses'
	| '/app/courses/manage'
	| '/app/calendar'
	| '/app/weekly'
	| '/app/timer'
	| '/app/chat'
	| '/app/digest'
	| '/app/brief'
	| '/app/activity'
	| '/app/settings';

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
	{
		href: '/app/courses',
		label: 'Course map',
		match: (pathname) =>
			pathname === '/app/courses' ||
			(pathname.startsWith('/app/courses/') && !pathname.startsWith('/app/courses/manage'))
	},
	{
		href: '/app/courses/manage',
		label: 'Manage courses',
		match: (pathname) => pathname.startsWith('/app/courses/manage')
	},
	{ href: '/app/calendar', label: 'Calendar' },
	{ href: '/app/weekly', label: 'Weekly plan' },
	{ href: '/app/timer', label: 'Study timer' },
	{ href: '/app/chat', label: 'Assistant' },
	{ href: '/app/digest', label: 'Weekly digest' },
	{ href: '/app/brief', label: 'Briefs' },
	{ href: '/app/activity', label: 'Activity' },
	{ href: '/app/settings', label: 'Settings' }
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
