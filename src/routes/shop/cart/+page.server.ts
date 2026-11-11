import { error, fail, redirect } from '@sveltejs/kit';
import {
	cartCanCheckout,
	cartId,
	forgetCart,
	formText,
	privateShopPage,
	requireShopOrigin,
	saveShopNotice,
	shopClient,
	shopQuantity,
	takeShopNotice
} from '$lib/server/shop-session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	privateShopPage(event);
	const id = cartId(event.cookies);
	try {
		const client = shopClient(event);
		const cart = id ? await client.cart(id) : null;
		if (id && !cart) forgetCart(event.cookies);
		const checkoutBlocked = cart ? !(await cartCanCheckout(client, cart)) : true;
		return {
			cart,
			checkoutBlocked,
			notice: takeShopNotice(event.cookies),
			title: 'Cart | Level One Shop',
			meta_description: 'Check your Level One shop cart.'
		};
	} catch {
		error(503, 'The cart is not available. Please try again shortly.');
	}
};

export const actions: Actions = {
	update: async (event) => {
		requireShopOrigin(event);
		const data = await event.request.formData();
		const id = cartId(event.cookies);
		const lineId = formText(data, 'lineId', 512);
		const quantity = shopQuantity(data);
		if (!id || !lineId || !quantity) {
			return fail(400, { message: 'Choose a cart item and a quantity from 1 to 99.' });
		}
		try {
			const client = shopClient(event);
			const cart = await client.cart(id);
			const line = cart?.lines.find((candidate) => candidate.id === lineId);
			if (!line) return fail(404, { message: 'This item is no longer in your cart.' });
			const product = await client.product(line.variant.product.handle);
			const variant = product?.variants.find((candidate) => candidate.id === line.variant.id);
			if (!variant?.availableForSale) {
				return fail(409, { message: 'This item is no longer available. Remove it from the cart.' });
			}
			const result = await client.updateLine(id, lineId, quantity);
			if (result.userErrors.length) {
				return fail(409, { message: result.userErrors.join(' ').slice(0, 600) });
			}
			if (!result.cart) return fail(502, { message: 'The cart did not update.' });
			saveShopNotice(event, result.warnings.join(' ') || 'The cart quantity has been updated.');
		} catch {
			return fail(503, {
				message: 'The cart could not be checked. Reload it before you try again.'
			});
		}
		redirect(303, '/shop/cart');
	},
	remove: async (event) => {
		requireShopOrigin(event);
		const data = await event.request.formData();
		const id = cartId(event.cookies);
		const lineId = formText(data, 'lineId', 512);
		if (!id || !lineId) return fail(400, { message: 'Choose the item to remove.' });
		try {
			const client = shopClient(event);
			const cart = await client.cart(id);
			if (!cart?.lines.some((line) => line.id === lineId)) {
				return fail(404, { message: 'This item is no longer in your cart.' });
			}
			const result = await client.removeLine(id, lineId);
			if (result.userErrors.length) {
				return fail(409, { message: result.userErrors.join(' ').slice(0, 600) });
			}
			if (!result.cart) return fail(502, { message: 'The cart did not update.' });
			saveShopNotice(event, result.warnings.join(' ') || 'The item has been removed.');
		} catch {
			return fail(503, {
				message: 'The cart could not be checked. Reload it before you try again.'
			});
		}
		redirect(303, '/shop/cart');
	},
	checkout: async (event) => {
		requireShopOrigin(event);
		const id = cartId(event.cookies);
		if (!id) return fail(400, { message: 'Your cart is empty.' });
		let checkoutUrl: string | null;
		try {
			const client = shopClient(event);
			const cart = await client.cart(id);
			if (!cart || !cart.totalQuantity) return fail(400, { message: 'Your cart is empty.' });
			if (!(await cartCanCheckout(client, cart))) {
				return fail(409, {
					message: 'An item is no longer available. Remove it before checkout.'
				});
			}
			checkoutUrl = await client.checkoutUrl(id);
			if (!checkoutUrl)
				return fail(502, { message: 'Checkout is not available. Please try again.' });
		} catch {
			return fail(503, { message: 'Checkout could not be checked. Please try again shortly.' });
		}
		redirect(303, checkoutUrl);
	}
};
