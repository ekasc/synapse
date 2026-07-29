// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			user: AppUser | null;
			sessionId: string | null;
		}

		interface PageData {
			user: AppUser | null;
		}
		// interface PageState {}
	}
}

type AppUser = {
	id: string;
	email: string;
	name: string | null;
};

export {};
