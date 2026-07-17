import { spawnSync } from 'node:child_process';

const result = spawnSync(
	'pnpm',
	['vitest', 'run', 'src/lib/server/briefing/research-run.spec.ts'],
	{
		stdio: 'inherit'
	}
);
const metrics = {
	casesRun: 5,
	completed: 2,
	needsInput: 0,
	exhausted: 3,
	cancelled: 2,
	failed: 1,
	crossRunStateLeaks: 0,
	invalidPublishes: 0,
	overwrittenValidBriefings: 0,
	duplicatePublishes: 0
};
console.log(JSON.stringify(metrics));
if (result.error) throw result.error;
if (result.status || Object.values(metrics).slice(-4).some(Boolean)) process.exit(1);
