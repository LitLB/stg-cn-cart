/**
 * Joins the base URL with additional paths, handling slashes appropriately.
 * @param baseUrl - The base URL.
 * @param paths - Additional URL segments to append.
 * @returns The correctly formatted full URL.
 */
export function resolveUrl(baseUrl: string, ...paths: string[]): string {
	const urlParts = [baseUrl, ...paths];

	return urlParts
		.map((part, index) => {
			if (index === 0) {
				return part.replace(/\/+$/, '');
			} else {
				return part.replace(/^\/+|\/+$/g, '');
			}
		})
		.filter(part => part.length > 0)
		.join('/');
}
