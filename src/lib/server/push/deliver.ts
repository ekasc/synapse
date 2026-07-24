import type { WeeklyDigest } from '$lib/dashboard/weekly';
import { buildPushRequest } from './encryption';

export type PushVapidConfig = {
	subject: string;
	privateKey: string;
	publicKey: string;
};

export type PushSubscriptionTarget = {
	endpoint: string;
	p256dh: string;
	auth: string;
};

export type PushPayload = {
	title: string;
	body: string;
	url: string;
	weekStart: string;
	weekEnd: string;
	priorityCount: number;
	overdueCount: number;
};

export type PushDeliverySummary = {
	attempted: number;
	delivered: number;
	failed: number;
	prunedEndpoints: string[];
};

const MAX_BODY_LENGTH = 190;

const truncate = (text: string, limit: number) =>
	text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;

/** Builds the notification payload strictly from the deterministic digest. */
export function buildPushPayload(digest: WeeklyDigest, prose: string | null): PushPayload {
	const fallback = digest.priorities[0]?.reason ?? 'Your plan for the next seven days is ready.';
	return {
		title: `Weekly Plan · ${digest.weekStart} → ${digest.weekEnd}`,
		body: truncate(prose?.trim() || fallback, MAX_BODY_LENGTH),
		url: '/app/weekly',
		weekStart: digest.weekStart,
		weekEnd: digest.weekEnd,
		priorityCount: digest.priorities.length,
		overdueCount: digest.deadlines.filter((deadline) => deadline.overdue).length
	};
}

/**
 * Delivers the digest to every subscription. Endpoints that answer 404/410
 * (expired or unsubscribed) are reported back so the caller can prune them.
 * `fetchImpl` is injectable so this stays testable without a network.
 */
export async function deliverWeeklyDigestPush(input: {
	digest: WeeklyDigest;
	prose: string | null;
	subscriptions: PushSubscriptionTarget[];
	vapid: PushVapidConfig;
	nowSeconds: number;
	fetchImpl?: typeof fetch;
}): Promise<PushDeliverySummary> {
	const fetchImpl = input.fetchImpl ?? fetch;
	const payload = buildPushPayload(input.digest, input.prose);
	const body = JSON.stringify(payload);
	const summary: PushDeliverySummary = {
		attempted: 0,
		delivered: 0,
		failed: 0,
		prunedEndpoints: []
	};
	for (const subscription of input.subscriptions) {
		summary.attempted += 1;
		try {
			const request = await buildPushRequest({
				subscription: {
					endpoint: subscription.endpoint,
					keys: { p256dh: subscription.p256dh, auth: subscription.auth }
				},
				payload: body,
				vapid: input.vapid,
				nowSeconds: input.nowSeconds,
				topic: `weekly-${input.digest.weekStart}`
			});
			const response = await fetchImpl(request.url, request.init);
			if (response.ok) {
				summary.delivered += 1;
			} else if (response.status === 404 || response.status === 410) {
				summary.prunedEndpoints.push(subscription.endpoint);
			} else {
				summary.failed += 1;
			}
		} catch {
			summary.failed += 1;
		}
	}
	return summary;
}
