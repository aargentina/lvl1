import { error, fail, redirect } from '@sveltejs/kit';
import {
	cartId,
	forgetCart,
	formText,
	privateShopPage,
	requireShopOrigin,
	saveCart,
	saveShopNotice,
	shopClient,
	shopQuantity
} from '$lib/server/shop-session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	privateShopPage(event);
	let product;
	try {
		product = await shopClient(event).product(event.params.handle);
	} catch {
		error(503, 'This product is not available. Please try again shortly.');
	}
	if (!product) error(404, 'This product is not in the public shop.');
	return {
		product,
		title: `${product.title} | Level One Shop`,
		meta_title: `${product.title} | Level One Shop`,
		meta_image: product.featuredImage,
		meta_description: product.description.slice(0, 160)
	};
};

export const actions: Actions = {
	add: async (event) => {
		requireShopOrigin(event);
		const data = await event.request.formData();
		const variantId = formText(data, 'variantId');
		const quantity = shopQuantity(data);
		if (!quantity || !variantId) {
			return fail(400, { message: 'Choose an item and a quantity from 1 to 99.' });
		}
		const client = shopClient(event);
		try {
			const product = await client.product(event.params.handle);
			const variant = product?.variants.find((candidate) => candidate.id === variantId);
			if (!variant) return fail(404, { message: 'This item is not in the public shop.' });
			if (!variant.availableForSale) return fail(409, { message: 'This item is sold out.' });
			let id = cartId(event.cookies);
			if (id && !(await client.cart(id))) {
				forgetCart(event.cookies);
				id = null;
			}
			const result = id
				? await client.addLines(id, variantId, quantity)
				: await client.createCart(variantId, quantity);
			if (result.cartId) saveCart(event, result.cartId);
			if (result.userErrors.length) {
				return fail(409, { message: result.userErrors.join(' ').slice(0, 600) });
			}
			if (!result.cart) return fail(502, { message: 'The cart did not update. Please try again.' });
			saveShopNotice(
				event,
				result.warnings.length
					? result.warnings.join(' ')
					: 'The cart has been updated. Check the quantity before checkout.'
			);
		} catch {
			// A failed write can have an unknown result. Do not repeat it here.
			return fail(503, {
				message: 'The cart could not be checked. Open the cart before you try again.'
			});
		}
		redirect(303, '/shop/cart');
	}
};
