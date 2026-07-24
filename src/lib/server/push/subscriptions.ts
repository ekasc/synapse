export type WeeklyPushSubscription = {
	id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	createdAt: string;
};

export type WeeklyPushSubscriptionInput = {
	endpoint: string;
	p256dh: string;
	auth: string;
};

type SubscriptionRow = {
	id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	created_at: string;
};

function rowToSubscription(row: SubscriptionRow): WeeklyPushSubscription {
	return {
		id: row.id,
		endpoint: row.endpoint,
		p256dh: row.p256dh,
		auth: row.auth,
		createdAt: row.created_at
	};
}

export function createWeeklyPushRepository(binding: D1Database) {
	return {
		async list(): Promise<WeeklyPushSubscription[]> {
			const result = await binding
				.prepare(
					'SELECT id, endpoint, p256dh, auth, created_at FROM weekly_push_subscriptions ORDER BY created_at ASC, id ASC'
				)
				.all<SubscriptionRow>();
			return (result.results ?? []).map(rowToSubscription);
		},

		async upsert(input: WeeklyPushSubscriptionInput): Promise<WeeklyPushSubscription> {
			const existing = await binding
				.prepare(
					'SELECT id, endpoint, p256dh, auth, created_at FROM weekly_push_subscriptions WHERE endpoint = ?1'
				)
				.bind(input.endpoint)
				.first<SubscriptionRow>();
			if (existing) {
				await binding
					.prepare('UPDATE weekly_push_subscriptions SET p256dh = ?1, auth = ?2 WHERE id = ?3')
					.bind(input.p256dh, input.auth, existing.id)
					.run();
				return rowToSubscription({ ...existing, p256dh: input.p256dh, auth: input.auth });
			}
			const record: WeeklyPushSubscription = {
				id: crypto.randomUUID(),
				endpoint: input.endpoint,
				p256dh: input.p256dh,
				auth: input.auth,
				createdAt: new Date().toISOString()
			};
			await binding
				.prepare(
					'INSERT INTO weekly_push_subscriptions (id, endpoint, p256dh, auth, created_at) VALUES (?1, ?2, ?3, ?4, ?5)'
				)
				.bind(record.id, record.endpoint, record.p256dh, record.auth, record.createdAt)
				.run();
			return record;
		},

		async removeByEndpoint(endpoint: string): Promise<void> {
			await binding
				.prepare('DELETE FROM weekly_push_subscriptions WHERE endpoint = ?1')
				.bind(endpoint)
				.run();
		}
	};
}
