import { error, redirect } from '@sveltejs/kit';
import { privateShopPage, shopClient } from '$lib/server/shop-session';
import { createClient } from '$lib/prismicio';
import { loadShopSettings } from '$lib/server/shop-settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	privateShopPage(event);
	const after = event.url.searchParams.get('after');
	if (after && after.length > 1024) redirect(303, '/shop');
	const collectionRead = Promise.resolve().then(() => shopClient(event).collection(after));
	const collectionDescription = collectionRead.then(
		(collection) => collection.description,
		() => ''
	);
	// Start both source reads now. Only failed settings need the collection text.
	const settingsRead = loadShopSettings(
		createClient({ fetch: event.fetch, cookies: event.cookies }),
		collectionDescription,
		event.cookies
	);
	let collection;
	try {
		collection = await collectionRead;
	} catch {
		if (after) redirect(303, '/shop');
		error(503, 'The shop is not available. Please try again shortly.');
	}
	if (after && collection.products.length === 0) redirect(303, '/shop');
	const shopSettings = await settingsRead;
	return {
		collection,
		shopSettings,
		title: 'Shop | Level One Game Pub',
		meta_description: 'Shop at Level One Game Pub in Ottawa.'
	};
};
