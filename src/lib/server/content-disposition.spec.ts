import { describe, expect, it } from 'vitest';
import { contentDispositionFor } from './content-disposition';

describe('contentDispositionFor', () => {
	it('emits a normal attachment header for a clean filename', () => {
		const header = contentDispositionFor('lecture-notes.pdf');
		expect(header).toBe(
			`attachment; filename="lecture-notes.pdf"; filename*=UTF-8''lecture-notes.pdf`
		);
	});

	it('escapes a double quote in the ASCII fallback so the header cannot be broken out of', () => {
		const header = contentDispositionFor('foo"bar.pdf');
		// The ASCII fallback never contains a double quote.
		const asciiPart = header.split('; filename="')[1].split('"')[0];
		expect(asciiPart).not.toContain('"');
		// The full header must remain a single line.
		expect(header.split('\r\n')).toHaveLength(1);
	});

	it('escapes a CR/LF injection in the ASCII fallback', () => {
		const header = contentDispositionFor('foo\r\nX-Foo: bar.pdf');
		// No CRLF should survive in either header segment.
		expect(header.includes('\r')).toBe(false);
		expect(header.includes('\n')).toBe(false);
	});

	it('percent-encodes unicode in filename*', () => {
		const header = contentDispositionFor('résumé.pdf');
		expect(header).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9.pdf");
		// Legacy slot must not contain raw non-ASCII bytes.
		const asciiPart = header.split('; filename="')[1].split('"')[0];
		expect(asciiPart).toBe('r_sum_.pdf');
	});

	it('replaces backslash and semicolon in the ASCII fallback', () => {
		const header = contentDispositionFor('foo\\bar;baz.pdf');
		const asciiPart = header.split('; filename="')[1].split('"')[0];
		expect(asciiPart).not.toContain('\\');
		expect(asciiPart).not.toContain(';');
	});
});
