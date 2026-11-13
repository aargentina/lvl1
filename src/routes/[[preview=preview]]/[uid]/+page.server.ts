import { asText } from '@prismicio/client';
import { createClient } from '$lib/prismicio';
import { error } from '@sveltejs/kit';
import { readPrismic } from '$lib/server/prismic-read';

export const prerender = 'auto'; // Re-enable prerendering

export async function load({ params, fetch, cookies }) {
	// Skip favicon and touch icon requests
	if (
		['favicon.ico', 'apple-touch-icon.png', 'apple-touch-icon-precomposed.png'].includes(params.uid)
	) {
		throw error(404, 'Not found');
	}

	const client = createClient({ fetch, cookies });

	const page = await readPrismic(client, cookies, (options) =>
		client.getByUID('page', params.uid, options)
	);

	return {
		page,
		title: asText(page.data.title),
		meta_description: page.data.meta_description,
		meta_title: page.data.meta_title,
		meta_image: page.data.meta_image?.url ? page.data.meta_image : null
	};
}

export async function entries() {
	const client = createClient();

	const pages = await client.getAllByType('page');

	return pages.map((page) => {
		return { uid: page.uid };
	});
}
