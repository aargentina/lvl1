import { asText } from '@prismicio/client';

import { createClient } from '$lib/prismicio';
import { readPrismic } from '$lib/server/prismic-read';

export async function load({ fetch, cookies }) {
	const client = createClient({ fetch, cookies });

	const page = await readPrismic(client, cookies, (options) =>
		client.getByUID('page', 'home', options)
	);

	return {
		page,
		title: asText(page.data.title),
		meta_description: page.data.meta_description,
		meta_title: page.data.meta_title,
		meta_image: page.data.meta_image?.url ? page.data.meta_image : null
	};
}

export function entries() {
	return [{}];
}
