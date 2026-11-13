// All shop requests use local fixtures. These tests do not call Shopify.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createServer as createHttpServer } from 'node:http';

const root = fileURLToPath(new URL('../', import.meta.url));
const prismicModule = '\0shop-test-prismic';
let server;
let hmrServer;
let collectionRoute;
let productRoute;
let cartRoute;
let prismicFixture;

before(async () => {
	hmrServer = createHttpServer();
	await new Promise((resolve) => hmrServer.listen(0, '127.0.0.1', resolve));
	server = await createServer({
		root,
		configFile: false,
		cacheDir: fileURLToPath(new URL('../node_modules/.vite-shop-routes-tests', import.meta.url)),
		resolve: {
			alias: [
				{ find: '$lib/prismicio', replacement: prismicModule },
				{ find: '$lib', replacement: fileURLToPath(new URL('../src/lib', import.meta.url)) }
			]
		},
		server: { host: '127.0.0.1', middlewareMode: true, watch: null, hmr: { server: hmrServer } },
		plugins: [
			{
				name: 'shop-test-environment',
				resolveId(id) {
					if (id === prismicModule) return id;
					if (id === '$app/environment') return '\0shop-test-environment';
				},
				load(id) {
					if (id === prismicModule)
						return `export const calls = []; export const types = [];
						export function createClient(config) {
							calls.push(config);
							return { async getSingle(type) {
								types.push(type);
								return { data: { heading: 'Games and events', intro: 'New shop introduction', banner: {}, notice: 'A shop notice' } };
							} };
						}`;
					if (id === '\0shop-test-environment') return 'export const dev = false;';
				}
			}
		]
	});
	[collectionRoute, productRoute, cartRoute] = await Promise.all([
		server.ssrLoadModule('/src/routes/shop/+page.server.ts'),
		server.ssrLoadModule('/src/routes/shop/[handle]/+page.server.ts'),
		server.ssrLoadModule('/src/routes/shop/cart/+page.server.ts')
	]);
	prismicFixture = await server.ssrLoadModule(prismicModule);
});

after(async () => {
	await server?.close();
	if (hmrServer?.listening) await new Promise((resolve) => hmrServer.close(resolve));
});

const money = { amount: '100.00', currencyCode: 'CAD' };
const pageInfo = { hasNextPage: false, endCursor: null };
const variantId = 'gid://shopify/ProductVariant/1';
const cartId = 'gid://shopify/Cart/opaque?key=server-secret';
const product = (available = true) => ({
	id: 'gid://shopify/Product/1',
	handle: 'test',
	title: 'Test',
	description: 'Plain description',
	availableForSale: available,
	featuredImage: null,
	priceRange: { minVariantPrice: money, maxVariantPrice: money },
	variants: {
		nodes: [
			{
				id: variantId,
				title: 'Default Title',
				availableForSale: available,
				price: money,
				image: null,
				selectedOptions: []
			}
		],
		pageInfo
	}
});
const membership = (handles = ['test']) => ({
	collection: {
		products: {
			nodes: handles.map((handle) => ({ handle })),
			pageInfo
		}
	}
});
const cart = () => ({
	id: cartId,
	totalQuantity: 1,
	lines: {
		nodes: [
			{
				id: 'gid://shopify/CartLine/1',
				quantity: 1,
				merchandise: {
					id: variantId,
					title: 'Default Title',
					price: money,
					image: null,
					product: { handle: 'test', title: 'Test' }
				}
			}
		],
		pageInfo
	},
	cost: { subtotalAmount: money, totalAmount: money, totalTaxAmount: null }
});

function event(options = {}) {
	const url = new URL(options.path ?? '/shop/test', 'https://www.levelonegamepub.com');
	const method = options.fields ? 'POST' : 'GET';
	const headers = options.fields ? { origin: options.origin ?? url.origin } : {};
	const request = new Request(url, {
		method,
		headers,
		...(options.fields ? { body: new URLSearchParams(options.fields) } : {})
	});
	const values = new Map(Object.entries(options.cookies ?? {}));
	const writes = [],
		calls = [],
		responseHeaders = {};
	const responses = [...(options.responses ?? [])];
	const cookies = {
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
	};
	return {
		url,
		request,
		params: { handle: 'test' },
		cookies,
		writes,
		calls,
		values,
		responseHeaders,
		getClientAddress: () => '192.0.2.1',
		setHeaders(value) {
			Object.assign(responseHeaders, value);
		},
		fetch: async (address, init) => {
			const body = JSON.parse(init.body);
			calls.push({ address, init, body });
			assert.ok(responses.length, `Unexpected shop request: ${body.query}`);
			const response = responses.shift();
			if (response instanceof Error) throw response;
			return Response.json(response);
		}
	};
}

const data = (value) => ({ data: value });
const isStatus = (status) => (result) => result?.status === status;
const addFields = { variantId, quantity: '1' };

test('the shop combines public Shopify products with Prismic settings and preview cookies', async () => {
	const input = event({
		path: '/shop',
		responses: [
			data({
				collection: {
					title: 'Public shop',
					description: 'Old collection introduction',
					products: { nodes: [], pageInfo }
				}
			})
		]
	});
	const result = await collectionRoute.load(input);
	assert.equal(result.collection.title, 'Public shop');
	assert.deepEqual(result.collection.products, []);
	assert.deepEqual(result.shopSettings, {
		heading: 'Games and events',
		intro: 'New shop introduction',
		banner: null,
		notice: 'A shop notice'
	});
	const clientOptions = prismicFixture.calls.at(-1);
	assert.equal(clientOptions.fetch, input.fetch);
	assert.equal(clientOptions.cookies, input.cookies);
	assert.equal(prismicFixture.types.at(-1), 'shop_settings');
	assert.equal(input.responseHeaders['Cache-Control'], 'private, no-store');
	assert.equal(input.calls.length, 1);
});

test('a sold-out product blocks an addition before any cart write', async () => {
	const input = event({
		fields: addFields,
		responses: [data(membership()), data({ product: product(false) })]
	});
	const result = await productRoute.actions.add(input);
	assert.equal(result.status, 409);
	assert.match(result.data.message, /sold out/i);
	assert.equal(input.calls.length, 2);
	assert.equal(
		input.calls.some((call) => call.body.query.includes('mutation')),
		false
	);
	assert.equal(input.writes.length, 0);
});

test('an injected variant outside the public product is rejected', async () => {
	const input = event({
		fields: { ...addFields, variantId: 'gid://shopify/ProductVariant/999' },
		responses: [data(membership()), data({ product: product() })]
	});
	const result = await productRoute.actions.add(input);
	assert.equal(result.status, 404);
	assert.equal(input.calls.length, 2);
	assert.equal(input.writes.length, 0);
});

test('cross-origin cart actions return 403 without an API call', async () => {
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
});

test('invalid quantities are rejected before an API call', async () => {
	for (const quantity of ['0', '-1', '1.5', '100', '01', '1e1', '']) {
		const input = event({ fields: { variantId, quantity } });
		const result = await productRoute.actions.add(input);
		assert.equal(result.status, 400);
		assert.equal(input.calls.length, 0);
	}
});

test('an absent collection or failed source returns 503', async () => {
	for (const response of [
		data({ collection: null }),
		new Error('source unavailable'),
		{ data: { collection: { title: 'partial' } }, errors: [{ message: 'source partial' }] }
	]) {
		const input = event({ path: '/shop', responses: [response] });
		await assert.rejects(collectionRoute.load(input), isStatus(503));
		assert.equal(input.responseHeaders['Cache-Control'], 'private, no-store');
	}
});

test('a direct product outside Public shop returns 404', async () => {
	const input = event({ responses: [data(membership(['other']))] });
	await assert.rejects(productRoute.load(input), isStatus(404));
	assert.equal(input.calls.length, 1);
});

test('checkout with no cart cookie is blocked without an API call', async () => {
	const input = event({ path: '/shop/cart', fields: {} });
	const result = await cartRoute.actions.checkout(input);
	assert.equal(result.status, 400);
	assert.equal(input.calls.length, 0);
});

test('cart load omits the full cart ID and sets a private cache header', async () => {
	const input = event({
		path: '/shop/cart',
		cookies: { level_one_shop_cart: cartId },
		responses: [data({ cart: cart() }), data(membership()), data({ product: product() })]
	});
	const result = await cartRoute.load(input);
	assert.equal(result.cart.totalQuantity, 1);
	assert.equal(result.checkoutBlocked, false);
	assert.equal('id' in result.cart, false);
	assert.doesNotMatch(JSON.stringify(result), /server-secret|opaque|checkoutUrl/);
	assert.equal(input.responseHeaders['Cache-Control'], 'private, no-store');
	assert.equal(input.calls[0].init.headers['Shopify-Storefront-Buyer-IP'], '192.0.2.1');
});

test('a failed stock recheck keeps the public cart visible and blocks checkout', async () => {
	const input = event({
		path: '/shop/cart',
		cookies: { level_one_shop_cart: cartId },
		responses: [data({ cart: cart() }), new Error('stock unavailable')]
	});
	const result = await cartRoute.load(input);
	assert.equal(result.cart.totalQuantity, 1);
	assert.equal(result.checkoutBlocked, true);
	assert.match(result.checkoutMessage, /Stock could not be checked/);
	assert.equal(input.calls.length, 2);
});

test('cart checks reuse one complete membership read and one read per product handle', async () => {
	const twoLines = cart();
	twoLines.totalQuantity = 2;
	twoLines.lines.nodes.push({ ...twoLines.lines.nodes[0], id: 'gid://shopify/CartLine/2' });
	const input = event({
		path: '/shop/cart',
		cookies: { level_one_shop_cart: cartId },
		responses: [data({ cart: twoLines }), data(membership()), data({ product: product() })]
	});
	const result = await cartRoute.load(input);
	assert.equal(result.checkoutBlocked, false);
	assert.equal(input.calls.length, 3);
});

test('repeated additions cannot put more than 99 of one variant in a cart', async () => {
	const largeCart = cart();
	largeCart.totalQuantity = 60;
	largeCart.lines.nodes[0].quantity = 60;
	const input = event({
		fields: { variantId, quantity: '40' },
		cookies: { level_one_shop_cart: cartId },
		responses: [data(membership()), data({ product: product() }), data({ cart: largeCart })]
	});
	const result = await productRoute.actions.add(input);
	assert.equal(result.status, 409);
	assert.match(result.data.message, /at most 99/);
	assert.equal(input.calls.length, 3);
	assert.equal(
		input.calls.some((call) => call.body.query.includes('mutation')),
		false
	);
	assert.equal(input.writes.length, 0);
});

test('an old cart quantity above 99 is visible but cannot check out', async () => {
	const largeCart = cart();
	largeCart.totalQuantity = 120;
	largeCart.lines.nodes[0].quantity = 120;
	const input = event({
		path: '/shop/cart',
		cookies: { level_one_shop_cart: cartId },
		responses: [data({ cart: largeCart })]
	});
	const result = await cartRoute.load(input);
	assert.equal(result.cart.totalQuantity, 120);
	assert.equal(result.checkoutBlocked, true);
	assert.match(result.checkoutMessage, /99 or fewer/);
	const checkout = event({
		path: '/shop/cart',
		fields: {},
		cookies: { level_one_shop_cart: cartId },
		responses: [data({ cart: largeCart })]
	});
	assert.equal((await cartRoute.actions.checkout(checkout)).status, 409);
	assert.equal(checkout.calls.length, 1);
});

test('the quantity ceiling counts repeated variant lines together', async () => {
	const value = cart();
	value.totalQuantity = 100;
	value.lines.nodes[0].quantity = 60;
	value.lines.nodes.push({ ...value.lines.nodes[0], id: 'gid://shopify/CartLine/2', quantity: 40 });
	const input = event({
		path: '/shop/cart',
		cookies: { level_one_shop_cart: cartId },
		responses: [data({ cart: value })]
	});
	const result = await cartRoute.load(input);
	assert.equal(result.cart.totalQuantity, 100);
	assert.equal(result.checkoutBlocked, true);
	assert.match(result.checkoutMessage, /99 or fewer/);
	assert.equal(input.calls.length, 1);
});

test('create uses a secure HttpOnly cookie and keeps the returned stock warning', async () => {
	const warning = 'Only 1 item is available. The cart quantity was reduced.';
	const input = event({
		fields: { variantId, quantity: '3' },
		responses: [
			data(membership()),
			data({ product: product() }),
			data({ cartCreate: { cart: cart(), userErrors: [], warnings: [{ message: warning }] } })
		]
	});
	await assert.rejects(
		productRoute.actions.add(input),
		(result) => result.status === 303 && result.location === '/shop/cart'
	);
	const saved = input.writes.find((write) => write.name === 'level_one_shop_cart');
	assert.equal(saved.value, cartId);
	assert.deepEqual(saved.settings, {
		path: '/shop',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 864000
	});
	const notice = input.writes.find((write) => write.name === 'level_one_shop_notice');
	assert.equal(notice.value, warning);
	assert.equal(input.calls.length, 3);
	assert.equal(input.calls[2].body.variables.input.lines[0].quantity, 3);
	const loadInput = event({
		path: '/shop/cart',
		cookies: { level_one_shop_cart: cartId, level_one_shop_notice: notice.value },
		responses: [data({ cart: cart() }), data(membership()), data({ product: product() })]
	});
	const loaded = await cartRoute.load(loadInput);
	assert.equal(loaded.cart.totalQuantity, 1);
	assert.equal(loaded.notice, warning);
	assert.equal(loadInput.values.has('level_one_shop_notice'), false);
});

test('an uncertain write is not retried and gives no false success notice', async () => {
	const input = event({
		fields: addFields,
		responses: [data(membership()), data({ product: product() }), new Error('response lost')]
	});
	const result = await productRoute.actions.add(input);
	assert.equal(result.status, 503);
	assert.match(result.data.message, /Open the cart/);
	assert.equal(input.calls.length, 3);
	assert.equal(input.writes.length, 0);
});
