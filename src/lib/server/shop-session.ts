import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { ShopifyStorefront } from './shopify';
import type { ShopCart } from '$lib/shop';

const CART_COOKIE = 'level_one_shop_cart';
const NOTICE_COOKIE = 'level_one_shop_notice';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 10;

export function shopClient(event: RequestEvent) {
	let buyerIp: string | undefined;
	if (!dev) {
		try {
			buyerIp = event.getClientAddress();
		} catch {
			// A local build has no buyer address.
		}
	}
	return new ShopifyStorefront(event.fetch, buyerIp);
}

export function privateShopPage(event: RequestEvent) {
	event.setHeaders({ 'Cache-Control': 'private, no-store' });
}

export function requireShopOrigin(event: RequestEvent) {
	if (event.request.headers.get('origin') !== event.url.origin) {
		error(403, 'Open the shop on this site before you change the cart.');
	}
}

export function cartId(cookies: Cookies) {
	const value = cookies.get(CART_COOKIE);
	return value && value.length <= 1024 && value.startsWith('gid://shopify/Cart/') ? value : null;
}

export function saveCart(event: RequestEvent, id: string) {
	if (!id.startsWith('gid://shopify/Cart/') || id.length > 1024) {
		throw new Error('The cart response is not valid.');
	}
	event.cookies.set(CART_COOKIE, id, {
		path: '/shop',
		httpOnly: true,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: COOKIE_MAX_AGE
	});
}

export function forgetCart(cookies: Cookies) {
	cookies.delete(CART_COOKIE, { path: '/shop' });
}

export function saveShopNotice(event: RequestEvent, message: string) {
	event.cookies.set(NOTICE_COOKIE, message.slice(0, 600), {
		path: '/shop',
		httpOnly: true,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: 60
	});
}

export function takeShopNotice(cookies: Cookies) {
	const notice = cookies.get(NOTICE_COOKIE) ?? null;
	if (notice) cookies.delete(NOTICE_COOKIE, { path: '/shop' });
	return notice;
}

export function formText(data: FormData, key: string, maxLength = 200) {
	const value = data.get(key);
	return typeof value === 'string' && value.length <= maxLength ? value : '';
}

export function shopQuantity(data: FormData) {
	const value = formText(data, 'quantity', 2);
	if (!/^[1-9]\d?$/.test(value)) return null;
	return Number(value);
}

export async function cartCanCheckout(client: ShopifyStorefront, cart: ShopCart) {
	if (!cart.lines.length || !cart.totalQuantity) return false;
	for (const line of cart.lines) {
		const product = await client.product(line.variant.product.handle);
		const variant = product?.variants.find((candidate) => candidate.id === line.variant.id);
		if (!variant?.availableForSale) return false;
	}
	return true;
}
