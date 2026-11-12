import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { ShopifyStorefront } from './shopify';
import { shopRoot, type ShopCart, type ShopScope } from '$lib/shop';

const CART_COOKIE = 'level_one_shop_cart';
const NOTICE_COOKIE = 'level_one_shop_notice';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 10;

function cartCookie(scope: ShopScope) {
	return scope === 'booking' ? 'level_one_booking_cart' : CART_COOKIE;
}

function noticeCookie(scope: ShopScope) {
	return scope === 'booking' ? 'level_one_booking_notice' : NOTICE_COOKIE;
}

export function saleProduct(client: ShopifyStorefront, handle: string, scope: ShopScope = 'shop') {
	return scope === 'booking' ? client.bookingProduct(handle) : client.product(handle);
}

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

export function cartId(cookies: Cookies, scope: ShopScope = 'shop') {
	const value = cookies.get(cartCookie(scope));
	return value && value.length <= 1024 && value.startsWith('gid://shopify/Cart/') ? value : null;
}

export function saveCart(event: RequestEvent, id: string, scope: ShopScope = 'shop') {
	if (!id.startsWith('gid://shopify/Cart/') || id.length > 1024) {
		throw new Error('The cart response is not valid.');
	}
	event.cookies.set(cartCookie(scope), id, {
		path: shopRoot(scope),
		httpOnly: true,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: COOKIE_MAX_AGE
	});
}

export function forgetCart(cookies: Cookies, scope: ShopScope = 'shop') {
	cookies.delete(cartCookie(scope), { path: shopRoot(scope) });
}

export function saveShopNotice(event: RequestEvent, message: string, scope: ShopScope = 'shop') {
	event.cookies.set(noticeCookie(scope), message.slice(0, 600), {
		path: shopRoot(scope),
		httpOnly: true,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: 60
	});
}

export function takeShopNotice(cookies: Cookies, scope: ShopScope = 'shop') {
	const notice = cookies.get(noticeCookie(scope)) ?? null;
	if (notice) cookies.delete(noticeCookie(scope), { path: shopRoot(scope) });
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

export async function cartCanCheckout(
	client: ShopifyStorefront,
	cart: ShopCart,
	scope: ShopScope = 'shop'
) {
	if (!cart.lines.length || !cart.totalQuantity) return false;
	for (const line of cart.lines) {
		const product = await saleProduct(client, line.variant.product.handle, scope);
		const variant = product?.variants.find((candidate) => candidate.id === line.variant.id);
		if (!variant?.availableForSale) return false;
	}
	return true;
}
