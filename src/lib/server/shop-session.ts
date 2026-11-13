import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { ShopifyStorefront } from './shopify';
import { shopRoot, type ShopCart, type ShopScope } from '$lib/shop';

const CART_COOKIE = 'level_one_shop_cart';
const NOTICE_COOKIE = 'level_one_shop_notice';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 10;
const BOOKING_RETURN_COOKIE = 'level_one_booking_return';

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

export function bookingReturnHandle(cookies: Cookies) {
	const handle = cookies.get(BOOKING_RETURN_COOKIE);
	return handle && /^[a-z0-9][a-z0-9-]{0,254}$/.test(handle) ? handle : null;
}

export function saveBookingReturn(event: RequestEvent, handle: string) {
	if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(handle)) return;
	event.cookies.set(BOOKING_RETURN_COOKIE, handle, {
		path: '/bookings',
		httpOnly: true,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: 3600
	});
}

export function forgetBookingReturn(cookies: Cookies) {
	cookies.delete(BOOKING_RETURN_COOKIE, { path: '/bookings' });
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

export function cartQuantityLimitExceeded(cart: ShopCart) {
	const quantities = new Map<string, number>();
	for (const line of cart.lines) {
		const quantity = (quantities.get(line.variant.id) ?? 0) + line.quantity;
		if (quantity > 99) return true;
		quantities.set(line.variant.id, quantity);
	}
	return false;
}

export async function cartCanCheckout(
	client: ShopifyStorefront,
	cart: ShopCart,
	scope: ShopScope = 'shop',
	readProduct = client.productReader(scope)
) {
	if (!cart.lines.length || !cart.totalQuantity || cartQuantityLimitExceeded(cart)) return false;
	for (const line of cart.lines) {
		const product = await readProduct(line.variant.product.handle);
		const variant = product?.variants.find((candidate) => candidate.id === line.variant.id);
		if (!variant?.availableForSale) return false;
	}
	return true;
}
