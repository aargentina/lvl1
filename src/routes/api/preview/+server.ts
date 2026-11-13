import { redirectToPreviewURL } from '@prismicio/svelte/kit';
import { createClient } from '$lib/prismicio.js';

export async function GET({ fetch, request, cookies }) {
	const client = createClient({ fetch });

	const response = await redirectToPreviewURL({ client, request, cookies });
	// Shop settings use the live shop loader, not the generic Prismic page loader.
	if (response.headers.get('location') === '/preview/shop') {
		const headers = new Headers(response.headers);
		headers.set('location', '/shop');
		return new Response(response.body, { status: response.status, headers });
	}
	return response;
}
