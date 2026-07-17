import { spawnSync } from 'node:child_process';

const result = spawnSync(
	'pnpm',
	[
		'vitest',
		'run',
		'src/lib/server/briefing/accuracy-gate.spec.ts',
		'src/lib/server/briefing/pipeline.spec.ts',
		'src/lib/server/briefing/validation.spec.ts'
	],
	{ stdio: 'inherit' }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
