export type SafeParseResult<T> =
	| { ok: true; data: T }
	| { ok: false; error: string };

/**
 * Safely parses a JSON string, returning a discriminated union instead of throwing.
 * If a validate function is provided, it runs on the parsed value and its errors
 * are also caught.
 */
export function safeParse<T>(
	raw: string,
	validate?: (value: unknown) => T
): SafeParseResult<T> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { ok: false, error: `JSON parse error: ${message}` };
	}

	if (!validate) {
		return { ok: true, data: parsed as T };
	}

	try {
		return { ok: true, data: validate(parsed) };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { ok: false, error: `Validation error: ${message}` };
	}
}

/**
 * Parses a JSON string, throwing a contextual error on failure.
 * Use when the parsed value is irrecoverable and the caller wants to propagate.
 */
export function mustParse<T>(
	raw: string,
	context: string,
	validate?: (value: unknown) => T
): T {
	const result = safeParse(raw, validate);
	if (!result.ok) {
		throw new Error(`${context}: ${result.error}`);
	}
	return result.data;
}
