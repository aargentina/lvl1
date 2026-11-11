import { error } from '@sveltejs/kit';
import { privateShopPage, shopClient } from '$lib/server/shop-session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	privateShopPage(event);
	const after = event.url.searchParams.get('after');
	if (after && after.length > 1024) error(400, 'This shop page link is not valid.');
	try {
		const collection = await shopClient(event).collection(after);
		return {
			collection,
			title: 'Shop | Level One Game Pub',
			meta_description: 'Shop at Level One Game Pub in Ottawa.'
		};
	} catch {
		error(503, 'The shop is not available. Please try again shortly.');
	}
};
