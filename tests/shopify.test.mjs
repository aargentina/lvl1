import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopifyStorefront } from '../src/lib/server/shopify.ts';

const money = { amount: '100.00', currencyCode: 'CAD' };
const image = { url: 'https://cdn.shopify.com/test.jpg', altText: null, width: 200, height: 200 };
const end = { hasNextPage: false, endCursor: null };
const more = (cursor) => ({ hasNextPage: true, endCursor: cursor });
const variant = {
	id: 'gid://shopify/ProductVariant/1',
	title: 'Default Title',
	availableForSale: false,
	price: money,
	image,
	selectedOptions: [{ name: 'Title', value: 'Default Title' }]
};
const product = {
	id: 'gid://shopify/Product/1',
	handle: 'test',
	title: 'Test',
	description: 'Plain text',
	availableForSale: false,
	featuredImage: image,
	priceRange: { minVariantPrice: money, maxVariantPrice: money },
	variants: { nodes: [variant], pageInfo: end }
};
const cartId = 'gid://shopify/Cart/opaque?key=private-key';
const line = (id = '1') => ({
	id: `gid://shopify/CartLine/${id}`,
	quantity: 1,
	merchandise: {
		id: variant.id,
		title: variant.title,
		price: money,
		image,
		product: { handle: 'test', title: 'Test' }
	}
});
const cart = (lines = [line()], pageInfo = end, totalQuantity = lines.length) => ({
	id: cartId,
	totalQuantity,
	lines: { nodes: lines, pageInfo },
	cost: { subtotalAmount: money, totalAmount: money, totalTaxAmount: null }
});
const member = (handles = ['test'], pageInfo = end) => ({
	collection: { products: { nodes: handles.map((handle) => ({ handle })), pageInfo } }
});
function mock(...responses) {
	const calls = [];
	const fetcher = async (url, init) => {
		calls.push({ url, init, body: JSON.parse(init.body) });
		assert.ok(responses.length, 'Unexpected request');
		const value = responses.shift();
		if (value instanceof Error) throw value;
		return new Response(JSON.stringify(value), { status: 200 });
	};
	return {
		client: new ShopifyStorefront(fetcher, '192.0.2.1'),
		calls,
		remaining: () => responses.length
	};
}
const data = (value) => ({ data: value });

test('tokenless collection uses the fixed shop, Canada and no-store', async () => {
	const { client, calls } = mock(
		data({
			collection: {
				title: 'Public shop',
				description: 'Selected items',
				products: { nodes: [product], pageInfo: end }
			}
		})
	);
	const result = await client.collection();
	assert.equal(result.products[0].handle, 'test');
	assert.equal('variants' in result.products[0], false);
	assert.equal(calls[0].url, 'https://levelonegamepub.myshopify.com/api/2026-10/graphql.json');
	assert.equal(calls[0].body.variables.handle, 'public-shop');
	assert.match(calls[0].body.query, /country: CA/);
	assert.equal(calls[0].init.cache, 'no-store');
	assert.ok(calls[0].init.signal instanceof AbortSignal);
	assert.deepEqual(calls[0].init.headers, {
		'Content-Type': 'application/json',
		'Shopify-Storefront-Buyer-IP': '192.0.2.1'
	});
});

test('source errors, partial GraphQL data and missing fields fail closed', async () => {
	for (const response of [
		new Error('network'),
		{ data: member(), errors: [{ message: 'partial' }] },
		data({ collection: null }),
		data({ collection: { title: 'Missing products' } })
	]) {
		const { client } = mock(response);
		await assert.rejects(client.collection());
	}
});

test('a product outside Public shop is absent without a product read', async () => {
	const { client, calls } = mock(data(member(['other'])));
	assert.equal(await client.product('test'), null);
	assert.equal(calls.length, 1);
});

test('membership errors do not fall back to an unrestricted product read', async () => {
	const { client, calls } = mock({ errors: [{ message: 'source failed' }], data: member() });
	await assert.rejects(client.product('test'));
	assert.equal(calls.length, 1);
});

test('membership and variant reads follow cursors and keep sold-out data', async () => {
	const secondVariant = {
		...variant,
		id: 'gid://shopify/ProductVariant/2',
		title: 'Large',
		availableForSale: true
	};
	const { client, calls, remaining } = mock(
		data(member(['other'], more('members-next'))),
		data(member()),
		data({
			product: { ...product, variants: { nodes: [variant], pageInfo: more('variants-next') } }
		}),
		data({ product: { ...product, variants: { nodes: [secondVariant], pageInfo: end } } })
	);
	const result = await client.product('test');
	assert.equal(result.variants.length, 2);
	assert.equal(result.variants[0].availableForSale, false);
	assert.equal(result.variants[1].availableForSale, true);
	assert.equal(calls[1].body.variables.after, 'members-next');
	assert.equal(calls[3].body.variables.after, 'variants-next');
	assert.equal(remaining(), 0);
});

test('bad cursors and more than ten variant pages fail closed', async () => {
	const repeating = mock(
		data(member()),
		...Array.from({ length: 2 }, (_, i) =>
			data({
				product: {
					...product,
					variants: {
						nodes: [{ ...variant, id: `gid://shopify/ProductVariant/${i}` }],
						pageInfo: more('same')
					}
				}
			})
		)
	);
	await assert.rejects(repeating.client.product('test'));
	const bounded = mock(
		data(member()),
		...Array.from({ length: 10 }, (_, i) =>
			data({
				product: {
					...product,
					variants: {
						nodes: [{ ...variant, id: `gid://shopify/ProductVariant/${i}` }],
						pageInfo: more(`page-${i}`)
					}
				}
			})
		)
	);
	await assert.rejects(bounded.client.product('test'));
	assert.equal(bounded.calls.length, 11);
});

test('cart pages merge, use the full server ID, and omit secret fields', async () => {
	const { client, calls } = mock(
		data({ cart: cart([line()], more('next'), 2) }),
		data({ cart: cart([line('2')], end, 2) })
	);
	const result = await client.cart(cartId);
	assert.equal(result.lines.length, 2);
	assert.equal(result.lines[0].variant.product.handle, 'test');
	assert.equal(calls[1].body.variables.id, cartId);
	assert.equal(calls[1].body.variables.after, 'next');
	assert.doesNotMatch(JSON.stringify(result), /private-key|checkoutUrl|opaque/);
	assert.equal('id' in result, false);
});

test('cart page source failure never returns a partial cart', async () => {
	const { client } = mock(data({ cart: cart([line()], more('next'), 2) }), {
		errors: [{ message: 'failed page' }]
	});
	await assert.rejects(client.cart(cartId));
});

test('inconsistent cart quantity and unknown merchandise fail closed', async () => {
	const first = mock(data({ cart: cart([line()], end, 2) }));
	await assert.rejects(first.client.cart(cartId));
	const second = mock(data({ cart: cart([{ ...line(), merchandise: {} }]) }));
	await assert.rejects(second.client.cart(cartId));
});

test('a sold-out create result keeps its warning and omits zero-quantity lines', async () => {
	const warning = 'This item is sold out. The cart quantity was reduced to zero.';
	const { client } = mock(
		data({
			cartCreate: {
				cart: cart([{ ...line(), quantity: 0 }], end, 0),
				userErrors: [],
				warnings: [{ message: warning }]
			}
		})
	);
	const result = await client.createCart(variant.id, 1);
	assert.equal(result.cartId, cartId);
	assert.equal(result.cart.totalQuantity, 0);
	assert.deepEqual(result.cart.lines, []);
	assert.deepEqual(result.warnings, [warning]);
	assert.deepEqual(result.userErrors, []);
});

test('create keeps the full ID in its server-only field and reports warnings', async () => {
	const { client, calls } = mock(
		data({
			cartCreate: { cart: cart(), userErrors: [], warnings: [{ message: 'Stock changed.' }] }
		})
	);
	const result = await client.createCart(variant.id, 1);
	assert.equal(result.cartId, cartId);
	assert.deepEqual(result.warnings, ['Stock changed.']);
	assert.doesNotMatch(JSON.stringify(result.cart), /private-key|opaque|checkoutUrl/);
	assert.deepEqual(calls[0].body.variables.input.lines, [
		{ merchandiseId: variant.id, quantity: 1 }
	]);
});

test('mutation errors are visible and writes are not retried', async () => {
	const { client, calls } = mock(
		data({
			cartLinesAdd: {
				cart: null,
				userErrors: [{ message: 'This item is sold out.' }],
				warnings: []
			}
		})
	);
	const result = await client.addLines(cartId, variant.id, 1);
	assert.equal(result.cart, null);
	assert.deepEqual(result.userErrors, ['This item is sold out.']);
	assert.equal(calls.length, 1);
	const failed = mock(new Error('unknown write result'));
	await assert.rejects(failed.client.addLines(cartId, variant.id, 1));
	assert.equal(failed.calls.length, 1);
});

test('updates and removals do not return the cart secret', async () => {
	const { client } = mock(
		data({ cartLinesUpdate: { cart: cart(), userErrors: [], warnings: [] } }),
		data({ cartLinesRemove: { cart: cart([], end, 0), userErrors: [], warnings: [] } })
	);
	const update = await client.updateLine(cartId, line().id, 1);
	const remove = await client.removeLine(cartId, line().id);
	assert.equal(update.cartId, null);
	assert.equal(remove.cartId, null);
	assert.doesNotMatch(JSON.stringify([update, remove]), /private-key|opaque/);
});

test('bad quantities and IDs do not send a write', async () => {
	const { client, calls } = mock();
	for (const quantity of [0, -1, 1.5, 100, NaN])
		await assert.rejects(client.createCart(variant.id, quantity));
	await assert.rejects(client.createCart('https://bad.test', 1));
	assert.equal(calls.length, 0);
});

test('checkout accepts the exact HTTPS Shopify and branded hosts with a cart path', async () => {
	for (const host of ['levelonegamepub.myshopify.com', 'checkout.levelonegamepub.com']) {
		const correct = `https://${host}/cart/c/opaque?key=private-key`;
		const good = mock(data({ cart: { checkoutUrl: correct } }));
		assert.equal(await good.client.checkoutUrl(cartId), correct);
		assert.equal(
			good.calls[0].url,
			'https://levelonegamepub.myshopify.com/api/2026-10/graphql.json'
		);
	}
});

test('checkout rejects host suffix attacks, userinfo, HTTP, ports and other paths', async () => {
	const correct = `https://levelonegamepub.myshopify.com/cart/c/opaque?key=private-key`;
	const good = mock(data({ cart: { checkoutUrl: correct } }));
	assert.equal(await good.client.checkoutUrl(cartId), correct);
	for (const url of [
		'http://levelonegamepub.myshopify.com/cart/c/a',
		'https://levelonegamepub.myshopify.com.evil.test/cart/c/a',
		'https://evil.test/cart/c/a',
		'https://user@levelonegamepub.myshopify.com/cart/c/a',
		'https://levelonegamepub.myshopify.com:444/cart/c/a',
		'https://levelonegamepub.myshopify.com/products/a',
		'http://checkout.levelonegamepub.com/cart/c/a',
		'https://checkout.levelonegamepub.com.evil.test/cart/c/a',
		'https://user@checkout.levelonegamepub.com/cart/c/a',
		'https://checkout.levelonegamepub.com:444/cart/c/a',
		'https://checkout.levelonegamepub.com/products/a',
		'https://checkout.levelonegamepub.com/checkouts/cn/a'
	]) {
		const bad = mock(data({ cart: { checkoutUrl: url } }));
		await assert.rejects(bad.client.checkoutUrl(cartId));
	}
});
