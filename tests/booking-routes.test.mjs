// These booking checks use local fixtures. They do not call Shopify.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createServer as createHttpServer } from 'node:http';

const root = fileURLToPath(new URL('../', import.meta.url));
let server;
let hmrServer;
let productRoute;
let cartRoute;
let publicCartRoute;
let handle;

before(async () => {
	hmrServer = createHttpServer();
	await new Promise((resolve) => hmrServer.listen(0, '127.0.0.1', resolve));
	server = await createServer({
		root,
		configFile: false,
		cacheDir: fileURLToPath(new URL('../node_modules/.vite-booking-routes-tests', import.meta.url)),
		resolve: { alias: { $lib: fileURLToPath(new URL('../src/lib', import.meta.url)) } },
		server: { host: '127.0.0.1', middlewareMode: true, hmr: { server: hmrServer }, watch: null },
		plugins: [
			{
				name: 'booking-test-environment',
				resolveId(id) {
					if (id === '$app/environment') return '\0booking-test-environment';
				},
				load(id) {
					if (id === '\0booking-test-environment') return 'export const dev = false;';
				}
			}
		]
	});
	const modules = await Promise.all([
		server.ssrLoadModule('/src/routes/bookings/[handle]/+page.server.ts'),
		server.ssrLoadModule('/src/routes/bookings/cart/+page.server.ts'),
		server.ssrLoadModule('/src/routes/shop/cart/+page.server.ts'),
		server.ssrLoadModule('/src/hooks.server.ts')
	]);
	[productRoute, cartRoute, publicCartRoute] = modules;
	handle = modules[3].handle;
});

after(async () => {
	await server?.close();
	if (hmrServer?.listening) await new Promise((resolve) => hmrServer.close(resolve));
});

const money = (quantity = 1) => ({ amount: (100 * quantity).toFixed(2), currencyCode: 'CAD' });
const pageInfo = { hasNextPage: false, endCursor: null };
const variantId = 'gid://shopify/ProductVariant/8';
const lineId = 'gid://shopify/CartLine/9';
const bookingCartId = 'gid://shopify/Cart/booking-opaque?key=booking-server-secret';
const publicCartId = 'gid://shopify/Cart/public-opaque?key=public-server-secret';
const checkoutUrl = 'https://checkout.levelonegamepub.com/cart/c/checkout-opaque?key=checkout-key';
const bookingCookie = 'level_one_booking_cart';
const bookingNotice = 'level_one_booking_notice';
const publicCookie = 'level_one_shop_cart';
const publicNotice = 'level_one_shop_notice';
const product = (available = true) => ({
	id: 'gid://shopify/Product/8',
	handle: 'private-booking',
	title: 'Private booking fixture',
	description: 'Private source description',
	availableForSale: available,
	featuredImage: null,
	priceRange: { minVariantPrice: money(), maxVariantPrice: money() },
	variants: {
		nodes: [
			{
				id: variantId,
				title: 'Default Title',
				availableForSale: available,
				price: money(),
				image: null,
				selectedOptions: []
			}
		],
		pageInfo
	}
});
const membership = (handles = ['public-item']) => ({
	collection: { products: { nodes: handles.map((value) => ({ handle: value })), pageInfo } }
});
const cart = (quantity = 1) => ({
	id: bookingCartId,
	totalQuantity: quantity,
	lines: {
		nodes:
			quantity > 0
				? [
						{
							id: lineId,
							quantity,
							merchandise: {
								id: variantId,
								title: 'Default Title',
								price: money(),
								image: null,
								product: { handle: 'private-booking', title: 'Private booking fixture' }
							}
						}
					]
				: [],
		pageInfo
	},
	cost: { subtotalAmount: money(quantity), totalAmount: money(quantity), totalTaxAmount: null }
});
const data = (value) => ({ data: value });
const isStatus = (status) => (result) => result?.status === status;
const isCartRedirect = (result) => result?.status === 303 && result.location === '/bookings/cart';
const addFields = { variantId, quantity: '1' };
const hasMutation = (input) => input.calls.some((call) => call.body.query.includes('mutation'));

function event(options = {}) {
	const url = new URL(
		options.path ?? '/bookings/private-booking',
		'https://www.levelonegamepub.com'
	);
	const request = new Request(url, {
		method: options.fields ? 'POST' : 'GET',
		headers: options.fields ? { origin: options.origin ?? url.origin } : {},
		...(options.fields ? { body: new URLSearchParams(options.fields) } : {})
	});
	const values = new Map(Object.entries(options.cookies ?? {}));
	const writes = [],
		calls = [],
		responseHeaders = {};
	const responses = [...(options.responses ?? [])];
	return {
		url,
		request,
		params: { handle: options.productHandle ?? 'private-booking' },
		cookies: {
			get(name) {
				return values.get(name);
			},
			set(name, value, settings) {
				values.set(name, value);
				writes.push({ name, value, settings });
			},
			delete(name, settings) {
				values.delete(name);
				writes.push({ name, deleted: true, settings });
			}
		},
		values,
		writes,
		calls,
		responseHeaders,
		getClientAddress: () => '192.0.2.1',
		setHeaders(headers) {
			Object.assign(responseHeaders, headers);
		},
		fetch: async (address, init) => {
			const body = JSON.parse(init.body);
			calls.push({ address, init, body });
			assert.ok(responses.length, `Unexpected booking request: ${body.query}`);
			const response = responses.shift();
			if (response instanceof Error) throw response;
			return Response.json(response);
		}
	};
}

test('booking load uses a generic title, omits product metadata and prevents caching', async () => {
	const input = event({ responses: [data(membership()), data({ product: product() })] });
	const result = await productRoute.load(input);
	assert.equal(result.title, 'Reservation booking | Level One Game Pub');
	assert.equal(result.product.handle, 'private-booking');
	const metadata = Object.fromEntries(
		Object.entries(result).filter(([name]) => name === 'title' || name.startsWith('meta_'))
	);
	assert.doesNotMatch(
		JSON.stringify(metadata),
		/Private booking fixture|Private source description/
	);
	assert.equal(input.responseHeaders['Cache-Control'], 'private, no-store');
	assert.equal(input.calls.length, 2);
});

test('booking responses keep privacy headers on success, error and redirect', async () => {
	for (const status of [200, 404, 500, 303]) {
		const response = await handle({
			event: event({ path: '/bookings/private-booking' }),
			resolve: async () =>
				new Response(status === 303 ? null : 'Fixture page', {
					status,
					headers: status === 303 ? { Location: '/bookings/cart' } : {}
				})
		});
		assert.equal(response.status, status);
		assert.equal(response.headers.get('cache-control'), 'private, no-store');
		assert.match(response.headers.get('x-robots-tag'), /noindex/);
		assert.equal(response.headers.get('referrer-policy'), 'strict-origin');
		if (status === 303) assert.equal(response.headers.get('location'), '/bookings/cart');
	}
});

test('private addition uses its own secure cookie and preserves a stock warning', async () => {
	const warning = 'Only one booking is available. The quantity was reduced.';
	const input = event({
		fields: { ...addFields, quantity: '2' },
		cookies: { [publicCookie]: publicCartId },
		responses: [
			data(membership()),
			data({ product: product() }),
			data({ cartCreate: { cart: cart(), userErrors: [], warnings: [{ message: warning }] } })
		]
	});
	await assert.rejects(productRoute.actions.add(input), isCartRedirect);
	const saved = input.writes.find((write) => write.name === bookingCookie);
	assert.equal(saved.value, bookingCartId);
	assert.deepEqual(saved.settings, {
		path: '/bookings',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 864000
	});
	const notice = input.writes.find((write) => write.name === bookingNotice);
	assert.equal(notice.value, warning);
	assert.equal(notice.settings.path, '/bookings');
	assert.equal(input.values.get(publicCookie), publicCartId);
	assert.equal(
		input.writes.some((write) => write.name === publicCookie || write.name === publicNotice),
		false
	);
	assert.equal(input.calls.length, 3);
	assert.match(input.calls[2].body.query, /cartCreate/);
	assert.equal(input.calls[2].body.variables.input.lines[0].quantity, 2);
});

test('booking and public carts ignore each other when only the other cookie exists', async () => {
	for (const [route, path, cookie] of [
		[cartRoute, '/bookings/cart', publicCookie],
		[publicCartRoute, '/shop/cart', bookingCookie]
	]) {
		const input = event({ path, cookies: { [cookie]: bookingCartId } });
		const result = await route.load(input);
		assert.equal(result.cart, null);
		assert.equal(result.checkoutBlocked, true);
		assert.equal(input.calls.length, 0);
		const checkout = event({ path, fields: {}, cookies: { [cookie]: bookingCartId } });
		assert.equal((await route.actions.checkout(checkout)).status, 400);
		assert.equal(checkout.calls.length, 0);
	}
});

test('booking cart reads only its cookie, consumes only its notice and omits its secret', async () => {
	const input = event({
		path: '/bookings/cart',
		cookies: {
			[bookingCookie]: bookingCartId,
			[publicCookie]: publicCartId,
			[bookingNotice]: 'Booking stock notice.',
			[publicNotice]: 'Public cart notice.'
		},
		responses: [data({ cart: cart() }), data(membership()), data({ product: product() })]
	});
	const result = await cartRoute.load(input);
	assert.equal(input.calls[0].body.variables.id, bookingCartId);
	assert.equal(result.cart.totalQuantity, 1);
	assert.equal(result.checkoutBlocked, false);
	assert.equal(result.notice, 'Booking stock notice.');
	assert.equal('id' in result.cart, false);
	assert.doesNotMatch(
		JSON.stringify(result),
		/booking-server-secret|public-server-secret|opaque|checkoutUrl/
	);
	assert.equal(input.responseHeaders['Cache-Control'], 'private, no-store');
	assert.equal(input.values.has(bookingNotice), false);
	assert.equal(input.values.get(publicNotice), 'Public cart notice.');
	assert.equal(input.values.get(publicCookie), publicCartId);
	assert.deepEqual(input.writes, [
		{
			name: 'level_one_booking_return',
			value: 'private-booking',
			settings: { path: '/bookings', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3600 }
		},
		{ name: bookingNotice, deleted: true, settings: { path: '/bookings' } }
	]);
});

test('a validated booking is remembered and can be opened again after the cart is empty', async () => {
	const page = event({ responses: [data(membership()), data({ product: product() })] });
	await productRoute.load(page);
	const hint = page.writes.find((write) => write.name === 'level_one_booking_return');
	assert.equal(hint.value, 'private-booking');
	assert.deepEqual(hint.settings, {
		path: '/bookings',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 3600
	});
	const empty = event({
		path: '/bookings/cart',
		cookies: { level_one_booking_return: hint.value },
		responses: [data(membership()), data({ product: product() })]
	});
	const result = await cartRoute.load(empty);
	assert.equal(result.cart, null);
	assert.equal(result.returnHandle, 'private-booking');
	assert.equal(result.checkoutBlocked, true);
	assert.equal(empty.calls.length, 2);
	const publicInput = event({
		path: '/shop/cart',
		cookies: { level_one_booking_return: hint.value }
	});
	assert.equal((await publicCartRoute.load(publicInput)).returnHandle, null);
	assert.equal(publicInput.calls.length, 0);
});

test('unchecked or now-public booking hints cannot become return links', async () => {
	for (const handle of ['../private-booking', 'https://other.test', 'UPPERCASE']) {
		const input = event({ path: '/bookings/cart', cookies: { level_one_booking_return: handle } });
		assert.equal((await cartRoute.load(input)).returnHandle, null);
		assert.equal(input.calls.length, 0);
	}
	for (const response of [data(membership(['private-booking'])), new Error('source unavailable')]) {
		const input = event({
			path: '/bookings/cart',
			cookies: { level_one_booking_return: 'private-booking' },
			responses: [response]
		});
		assert.equal((await cartRoute.load(input)).returnHandle, null);
		assert.equal(input.calls.length, 1);
		if (response instanceof Error)
			assert.equal(input.values.get('level_one_booking_return'), 'private-booking');
		else assert.equal(input.values.has('level_one_booking_return'), false);
	}
});

test('a failed booking stock recheck keeps the cart visible and removable', async () => {
	const input = event({
		path: '/bookings/cart',
		cookies: { [bookingCookie]: bookingCartId },
		responses: [data({ cart: cart() }), new Error('membership unavailable')]
	});
	const result = await cartRoute.load(input);
	assert.equal(result.cart.totalQuantity, 1);
	assert.equal(result.checkoutBlocked, true);
	assert.match(result.checkoutMessage, /Stock could not be checked/);
	assert.equal(result.returnHandle, null);
	assert.equal(input.calls.length, 2);
	const remove = event({
		path: '/bookings/cart',
		fields: { lineId },
		cookies: { [bookingCookie]: bookingCartId },
		responses: [
			data({ cart: cart() }),
			data({ cartLinesRemove: { cart: cart(0), userErrors: [], warnings: [] } })
		]
	});
	await assert.rejects(cartRoute.actions.remove(remove), isCartRedirect);
	assert.equal(remove.calls.length, 2);
});

test('a Public shop product cannot open or be added through a booking URL', async () => {
	const loadInput = event({ responses: [data(membership(['private-booking']))] });
	await assert.rejects(productRoute.load(loadInput), isStatus(404));
	const addInput = event({ fields: addFields, responses: [data(membership(['private-booking']))] });
	const result = await productRoute.actions.add(addInput);
	assert.equal(result.status, 404);
	assert.equal(addInput.calls.length, 1);
	assert.equal(hasMutation(addInput), false);
	assert.equal(addInput.writes.length, 0);
});

test('an arbitrary variant cannot be added to the private booking', async () => {
	const input = event({
		fields: { ...addFields, variantId: 'gid://shopify/ProductVariant/999' },
		responses: [data(membership()), data({ product: product() })]
	});
	assert.equal((await productRoute.actions.add(input)).status, 404);
	assert.equal(hasMutation(input), false);
	assert.equal(input.writes.length, 0);
});

test('sold-out and failed stock reads cannot create a booking cart', async () => {
	for (const [response, expectedStatus] of [
		[data({ product: product(false) }), 409],
		[new Error('stock source failed'), 503]
	]) {
		const input = event({ fields: addFields, responses: [data(membership()), response] });
		assert.equal((await productRoute.actions.add(input)).status, expectedStatus);
		assert.equal(hasMutation(input), false);
		assert.equal(input.writes.length, 0);
	}
	for (const response of [data({ collection: null }), new Error('membership failed')]) {
		const input = event({ responses: [response] });
		await assert.rejects(productRoute.load(input), isStatus(503));
		assert.equal(input.calls.length, 1);
		assert.equal(input.responseHeaders['Cache-Control'], 'private, no-store');
	}
});

test('cross-origin booking writes and invalid quantities make no source call', async () => {
	for (const action of [
		productRoute.actions.add,
		cartRoute.actions.update,
		cartRoute.actions.remove,
		cartRoute.actions.checkout
	]) {
		const input = event({ fields: addFields, origin: 'https://other.test' });
		await assert.rejects(action(input), isStatus(403));
		assert.equal(input.calls.length, 0);
	}
	for (const quantity of ['0', '-1', '1.5', '100', '01', '1e1', '']) {
		for (const action of [productRoute.actions.add, cartRoute.actions.update]) {
			const input = event({
				fields: { variantId, lineId, quantity },
				cookies: { [bookingCookie]: bookingCartId }
			});
			assert.equal((await action(input)).status, 400);
			assert.equal(input.calls.length, 0);
		}
	}
});

test('booking checkout blocks an item that has moved into Public shop', async () => {
	const input = event({
		path: '/bookings/cart',
		fields: {},
		cookies: { [bookingCookie]: bookingCartId },
		responses: [data({ cart: cart() }), data(membership(['private-booking']))]
	});
	const result = await cartRoute.actions.checkout(input);
	assert.equal(result.status, 409);
	assert.match(result.data.message, /no longer available/i);
	assert.equal(input.calls.length, 2);
	assert.equal(
		input.calls.some((call) => call.body.query.includes('ShopCheckout')),
		false
	);
});

test('an uncertain booking write is not retried or reported as success', async () => {
	const input = event({
		fields: addFields,
		responses: [data(membership()), data({ product: product() }), new Error('write response lost')]
	});
	const result = await productRoute.actions.add(input);
	assert.equal(result.status, 503);
	assert.match(result.data.message, /Open the cart/);
	assert.equal(input.calls.length, 3);
	assert.equal(input.calls.filter((call) => call.body.query.includes('mutation')).length, 1);
	assert.equal(input.writes.length, 0);
});

test('booking quantity update checks stock and keeps its returned warning', async () => {
	const warning = 'The booking quantity was changed to match available stock.';
	const input = event({
		path: '/bookings/cart',
		fields: { lineId, quantity: '2' },
		cookies: { [bookingCookie]: bookingCartId },
		responses: [
			data({ cart: cart() }),
			data(membership()),
			data({ product: product() }),
			data({ cartLinesUpdate: { cart: cart(2), userErrors: [], warnings: [{ message: warning }] } })
		]
	});
	await assert.rejects(cartRoute.actions.update(input), isCartRedirect);
	assert.equal(input.calls[3].body.variables.cartId, bookingCartId);
	assert.deepEqual(input.calls[3].body.variables.lines, [{ id: lineId, quantity: 2 }]);
	assert.equal(input.writes.find((write) => write.name === bookingNotice).value, warning);
	const soldOut = event({
		path: '/bookings/cart',
		fields: { lineId, quantity: '2' },
		cookies: { [bookingCookie]: bookingCartId },
		responses: [data({ cart: cart() }), data(membership()), data({ product: product(false) })]
	});
	assert.equal((await cartRoute.actions.update(soldOut)).status, 409);
	assert.equal(hasMutation(soldOut), false);
});

test('booking removal acts only on the booking cart and can leave it empty', async () => {
	const input = event({
		path: '/bookings/cart',
		fields: { lineId },
		cookies: { [bookingCookie]: bookingCartId, [publicCookie]: publicCartId },
		responses: [
			data({ cart: cart() }),
			data({ cartLinesRemove: { cart: cart(0), userErrors: [], warnings: [] } })
		]
	});
	await assert.rejects(cartRoute.actions.remove(input), isCartRedirect);
	assert.equal(input.calls[1].body.variables.cartId, bookingCartId);
	assert.deepEqual(input.calls[1].body.variables.lineIds, [lineId]);
	assert.equal(input.values.get(publicCookie), publicCartId);
	assert.equal(
		input.writes.every(
			(write) => write.name === bookingNotice && write.settings.path === '/bookings'
		),
		true
	);
	const empty = event({
		path: '/bookings/cart',
		cookies: { [bookingCookie]: bookingCartId },
		responses: [data({ cart: cart(0) })]
	});
	const result = await cartRoute.load(empty);
	assert.equal(result.cart.totalQuantity, 0);
	assert.deepEqual(result.cart.lines, []);
	assert.equal(result.checkoutBlocked, true);
});

test('booking checkout returns the native 303 to the branded Shopify host', async () => {
	const input = event({
		path: '/bookings/cart',
		fields: {},
		cookies: { [bookingCookie]: bookingCartId, [publicCookie]: publicCartId },
		responses: [
			data({ cart: cart() }),
			data(membership()),
			data({ product: product() }),
			data({ cart: { checkoutUrl } })
		]
	});
	await assert.rejects(
		cartRoute.actions.checkout(input),
		(result) => result.status === 303 && result.location === checkoutUrl
	);
	assert.equal(input.calls.length, 4);
	assert.equal(input.calls[3].body.variables.id, bookingCartId);
	assert.equal(input.writes.length, 0);
	const failure = event({
		path: '/bookings/cart',
		fields: {},
		cookies: { [bookingCookie]: bookingCartId },
		responses: [data({ cart: cart() }), new Error('membership unavailable')]
	});
	assert.equal((await cartRoute.actions.checkout(failure)).status, 503);
	assert.equal(failure.calls.length, 2);
});
