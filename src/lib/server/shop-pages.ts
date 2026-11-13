import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { shopRoot, type ShopScope } from '$lib/shop';
import {
	cartCanCheckout,
	cartQuantityLimitExceeded,
	bookingReturnHandle,
	cartId,
	forgetCart,
	forgetBookingReturn,
	formText,
	privateShopPage,
	requireShopOrigin,
	saleProduct,
	saveCart,
	saveBookingReturn,
	saveShopNotice,
	shopClient,
	shopQuantity,
	takeShopNotice
} from '$lib/server/shop-session';

export async function loadSaleProduct(event: RequestEvent, scope: ShopScope = 'shop') {
	privateShopPage(event);
	let product;
	try {
		product = await saleProduct(shopClient(event), event.params.handle ?? '', scope);
	} catch {
		error(503, 'This product is not available. Please try again shortly.');
	}
	if (!product) error(404, 'This item is not available here.');
	if (scope === 'booking') {
		saveBookingReturn(event, product.handle);
		return { product, title: 'Reservation booking | Level One Game Pub' };
	}
	return {
		product,
		title: `${product.title} | Level One Shop`,
		meta_title: `${product.title} | Level One Shop`,
		meta_image: product.featuredImage,
		meta_description: product.description.slice(0, 160)
	};
}

export async function addSaleProduct(event: RequestEvent, scope: ShopScope = 'shop') {
	requireShopOrigin(event);
	const data = await event.request.formData();
	const variantId = formText(data, 'variantId');
	const quantity = shopQuantity(data);
	if (!quantity || !variantId) {
		return fail(400, { message: 'Choose an item and a quantity from 1 to 99.' });
	}
	const client = shopClient(event);
	try {
		const product = await saleProduct(client, event.params.handle ?? '', scope);
		const variant = product?.variants.find((candidate) => candidate.id === variantId);
		if (!variant) return fail(404, { message: 'This item is not available here.' });
		if (!variant.availableForSale) return fail(409, { message: 'This item is sold out.' });
		let id = cartId(event.cookies, scope);
		const existingCart = id ? await client.cart(id) : null;
		if (id && !existingCart) {
			forgetCart(event.cookies, scope);
			id = null;
		}
		const existingQuantity =
			existingCart?.lines
				.filter((line) => line.variant.id === variantId)
				.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
		if (existingQuantity + quantity > 99) {
			return fail(409, {
				message: 'A cart can have at most 99 of this option. Open the cart to change its quantity.'
			});
		}
		const result = id
			? await client.addLines(id, variantId, quantity)
			: await client.createCart(variantId, quantity);
		if (result.cartId) saveCart(event, result.cartId, scope);
		if (result.userErrors.length) {
			return fail(409, { message: result.userErrors.join(' ').slice(0, 600) });
		}
		if (!result.cart) return fail(502, { message: 'The cart did not update. Please try again.' });
		if (scope === 'booking') saveBookingReturn(event, product!.handle);
		saveShopNotice(
			event,
			result.warnings.length
				? result.warnings.join(' ')
				: 'The cart has been updated. Check the quantity before checkout.',
			scope
		);
	} catch {
		// A failed write can have an unknown result. Do not repeat it here.
		return fail(503, {
			message: 'The cart could not be checked. Open the cart before you try again.'
		});
	}
	redirect(303, `${shopRoot(scope)}/cart`);
}

export async function loadSaleCart(event: RequestEvent, scope: ShopScope = 'shop') {
	privateShopPage(event);
	const id = cartId(event.cookies, scope);
	try {
		const client = shopClient(event);
		const cart = id ? await client.cart(id) : null;
		if (id && !cart) forgetCart(event.cookies, scope);
		const readProduct = client.productReader(scope);
		let checkoutBlocked = true,
			checkoutMessage: string | null = null;
		try {
			checkoutBlocked = cart ? !(await cartCanCheckout(client, cart, scope, readProduct)) : true;
			if (cart && cartQuantityLimitExceeded(cart)) {
				checkoutMessage = 'Set each option to 99 or fewer before checkout.';
			}
		} catch {
			checkoutMessage =
				'Stock could not be checked. You can remove items, or reload the cart before checkout.';
		}
		let returnHandle: string | null = null;
		if (scope === 'booking') {
			const savedHandle = bookingReturnHandle(event.cookies);
			const handle = savedHandle ?? cart?.lines[0]?.variant.product.handle;
			if (handle) {
				try {
					const product = await readProduct(handle);
					if (product) {
						returnHandle = product.handle;
						if (!savedHandle) saveBookingReturn(event, product.handle);
					} else if (savedHandle) forgetBookingReturn(event.cookies);
				} catch {
					// Keep the saved hint on a failed read, but expose no unchecked link.
				}
			}
		}
		return {
			cart,
			checkoutBlocked,
			checkoutMessage,
			returnHandle,
			notice: takeShopNotice(event.cookies, scope),
			title: scope === 'booking' ? 'Booking cart | Level One Game Pub' : 'Cart | Level One Shop',
			...(scope === 'shop' ? { meta_description: 'Check your Level One shop cart.' } : {})
		};
	} catch {
		error(503, 'The cart is not available. Please try again shortly.');
	}
}

export async function updateSaleCart(event: RequestEvent, scope: ShopScope = 'shop') {
	requireShopOrigin(event);
	const data = await event.request.formData();
	const id = cartId(event.cookies, scope);
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
		const product = await saleProduct(client, line.variant.product.handle, scope);
		const variant = product?.variants.find((candidate) => candidate.id === line.variant.id);
		if (!variant?.availableForSale) {
			return fail(409, { message: 'This item is no longer available. Remove it from the cart.' });
		}
		const result = await client.updateLine(id, lineId, quantity);
		if (result.userErrors.length) {
			return fail(409, { message: result.userErrors.join(' ').slice(0, 600) });
		}
		if (!result.cart) return fail(502, { message: 'The cart did not update.' });
		saveShopNotice(
			event,
			result.warnings.join(' ') || 'The cart quantity has been updated.',
			scope
		);
	} catch {
		return fail(503, {
			message: 'The cart could not be checked. Reload it before you try again.'
		});
	}
	redirect(303, `${shopRoot(scope)}/cart`);
}

export async function removeSaleCart(event: RequestEvent, scope: ShopScope = 'shop') {
	requireShopOrigin(event);
	const data = await event.request.formData();
	const id = cartId(event.cookies, scope);
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
		saveShopNotice(event, result.warnings.join(' ') || 'The item has been removed.', scope);
	} catch {
		return fail(503, {
			message: 'The cart could not be checked. Reload it before you try again.'
		});
	}
	redirect(303, `${shopRoot(scope)}/cart`);
}

export async function checkoutSaleCart(event: RequestEvent, scope: ShopScope = 'shop') {
	requireShopOrigin(event);
	const id = cartId(event.cookies, scope);
	if (!id) return fail(400, { message: 'Your cart is empty.' });
	let checkoutUrl: string | null;
	try {
		const client = shopClient(event);
		const cart = await client.cart(id);
		if (!cart || !cart.totalQuantity) return fail(400, { message: 'Your cart is empty.' });
		if (!(await cartCanCheckout(client, cart, scope))) {
			return fail(409, {
				message: 'An item is no longer available. Remove it before checkout.'
			});
		}
		checkoutUrl = await client.checkoutUrl(id);
		if (!checkoutUrl) return fail(502, { message: 'Checkout is not available. Please try again.' });
	} catch {
		return fail(503, { message: 'Checkout could not be checked. Please try again shortly.' });
	}
	redirect(303, checkoutUrl);
}
