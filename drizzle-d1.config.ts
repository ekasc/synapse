import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/d1-schema.ts',
	out: './migrations',
	dialect: 'sqlite',
	verbose: true,
	strict: true
});
