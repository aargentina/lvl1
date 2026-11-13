import { redirectToPreviewURL } from '@prismicio/svelte/kit';
import { createClient } from '$lib/prismicio.js';
import { cookie, PreviewTokenExpiredError } from '@prismicio/client';

export async function GET({ fetch, request, cookies }) {
	const client = createClient({ fetch });

	let response;
	try {
		response = await redirectToPreviewURL({ client, request, cookies });
	} catch (cause) {
		if (!(cause instanceof PreviewTokenExpiredError)) throw cause;
		cookies.delete(cookie.preview, { path: '/' });
		// Do not retry an old external preview token or use a supplied return URL.
		return new Response(null, {
			status: 303,
			headers: {
				Location: '/',
				'Cache-Control': 'private, no-store',
				'X-Robots-Tag': 'noindex, nofollow'
			}
		});
	}
	// Shop settings use the live shop loader, not the generic Prismic page loader.
	if (response.headers.get('location') === '/preview/shop') {
		const headers = new Headers(response.headers);
		headers.set('location', '/shop');
		return new Response(response.body, { status: response.status, headers });
	}
	return response;
}
