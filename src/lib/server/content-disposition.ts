/**
 * Build a Content-Disposition header that is safe even when the filename is
 * user-controlled. Anything outside the printable ASCII set goes through
 * RFC 5987 `filename*`; the legacy `filename` slot only ever contains a
 * stripped ASCII fallback so it cannot be used to break out of the quoted
 * string or inject extra header lines.
 */
export function contentDispositionFor(fileName: string): string {
	const ascii = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\;\r\n]/g, '_');
	const encoded = encodeURIComponent(fileName).replace(
		/['()*]/g,
		(c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
	);
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
