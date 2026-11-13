// These checks render local fixtures. No Shopify request or service token is used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createServer } from 'vite';
import { createServer as createHttpServer } from 'node:http';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const root = fileURLToPath(new URL('../', import.meta.url));
const formModule = '\0shop-ui-test-forms';
const money = (amount) => ({ amount, currencyCode: 'CAD' });
const variant = (extra = {}) => ({
	id: 'gid://shopify/ProductVariant/2',
	title: 'Default Title',
	availableForSale: false,
	price: money('100.00'),
	image: null,
	selectedOptions: [{ name: 'Title', value: 'Default Title' }],
	...extra
});
const product = (extra = {}) => ({
	id: 'gid://shopify/Product/1',
	handle: 'test',
	title: 'Test',
	description: 'A local product fixture.',
	availableForSale: false,
	featuredImage: null,
	priceRange: { minVariantPrice: money('100.00'), maxVariantPrice: money('100.00') },
	variants: [variant()],
	...extra
});
const collection = (extra = {}) => ({
	title: 'Public shop',
	description: 'Items selected for public sale.',
	products: [product()],
	pageInfo: { hasNextPage: false, endCursor: null },
	...extra
});
const shopSettings = (extra = {}) => ({
	heading: 'Shop',
	intro: 'Items selected for public sale.',
	banner: { url: '/redesign/games-bg.jpg', alt: '' },
	notice: '',
	...extra
});
const cart = (extra = {}) => ({
	totalQuantity: 2,
	lines: [
		{
			id: 'gid://shopify/CartLine/3',
			quantity: 2,
			variant: {
				...variant(),
				price: money('13.25'),
				product: { handle: 'test', title: 'Test' }
			}
		}
	],
	cost: {
		subtotalAmount: money('25.50'),
		totalAmount: money('28.82'),
		totalTaxAmount: money('3.32')
	},
	...extra
});
const buttons = (html) => html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
const formByAction = (html, action) =>
	(html.match(/<form\b[^>]*>[\s\S]*?<\/form>/g) ?? []).find((form) =>
		form.includes(`action="?/${action}"`)
	);

test('shop pages render current sale data and safe purchase states', async (t) => {
	const hmrServer = createHttpServer();
	await new Promise((resolve) => hmrServer.listen(0, '127.0.0.1', resolve));
	const server = await createServer({
		root,
		configFile: false,
		cacheDir: path.join(root, 'node_modules/.vite-shop-ui-tests'),
		plugins: [
			{
				name: 'shop-ui-test-forms',
				resolveId(id) {
					return id === '$app/forms' ? formModule : null;
				},
				load(id) {
					return id === formModule ? 'export function enhance() {}' : null;
				}
			},
			svelte({ configFile: false, preprocess: vitePreprocess(), hot: false })
		],
		resolve: { alias: { $lib: path.join(root, 'src/lib') } },
		server: { host: '127.0.0.1', middlewareMode: true, hmr: { server: hmrServer }, watch: null },
		ssr: { noExternal: ['svelte'] },
		optimizeDeps: { noDiscovery: true, include: [] }
	});
	try {
		const { render } = await server.ssrLoadModule('svelte/server');
		const { default: Shop } = await server.ssrLoadModule('/src/routes/shop/+page.svelte');
		const { default: Product } = await server.ssrLoadModule(
			'/src/routes/shop/[handle]/+page.svelte'
		);
		const { default: Cart } = await server.ssrLoadModule('/src/routes/shop/cart/+page.svelte');
		const { default: Booking } = await server.ssrLoadModule(
			'/src/routes/bookings/[handle]/+page.svelte'
		);
		const { default: BookingCart } = await server.ssrLoadModule(
			'/src/routes/bookings/cart/+page.svelte'
		);
		const renderShop = (value, settings = shopSettings({ intro: value.description })) =>
			render(Shop, { props: { data: { collection: value, shopSettings: settings } } }).body;
		const renderProduct = (value, form = null) =>
			render(Product, { props: { data: { product: value }, form } }).body;
		const renderCart = (value, extra = {}, form = null) =>
			render(Cart, {
				props: { data: { cart: value, notice: null, checkoutBlocked: false, ...extra }, form }
			}).body;
		const renderBooking = (value, form = null) =>
			render(Booking, { props: { data: { product: value }, form } }).body;
		const renderBookingCart = (value, extra = {}, form = null) =>
			render(BookingCart, {
				props: {
					data: {
						cart: value,
						notice: null,
						checkoutBlocked: false,
						returnHandle: value?.lines[0]?.variant.product.handle ?? null,
						...extra
					},
					form
				}
			}).body;

		await t.test(
			'Prismic shop fields change the page without changing Shopify product cards',
			() => {
				const html = renderShop(
					collection(),
					shopSettings({
						heading: 'Games and events',
						intro: 'Find your next game.\nBook an event.',
						banner: {
							url: 'https://images.prismic.io/lvl1/shop-banner-fixture.jpg',
							alt: 'Games at Level One'
						},
						notice: 'Event tickets cannot be returned.'
					})
				);
				assert.match(html, /<h1\b[^>]*>Games and events<\/h1>/);
				assert.match(html, /Find your next game\.\nBook an event\./);
				assert.match(html, /src="https:\/\/images\.prismic\.io\/lvl1\/shop-banner-fixture\.jpg"/);
				assert.match(html, /alt=""/);
				assert.doesNotMatch(html, /alt="Games at Level One"/);
				assert.match(html, /Event tickets cannot be returned\./);
				assert.doesNotMatch(html, /Items selected for public sale\./);
				assert.match(html, /href="\/shop\/test"/);
				assert.match(html, /\$100\.00/);
				assert.match(html, /Sold out/);
			}
		);

		await t.test('shop text and banner alt text are escaped', () => {
			const text = '<img src=x onerror=alert(1)><script>alert(2)</script>';
			const html = renderShop(
				collection(),
				shopSettings({
					heading: text,
					intro: text,
					banner: { url: 'https://images.prismic.io/lvl1/shop-banner-fixture.jpg', alt: text },
					notice: text
				})
			);
			assert.doesNotMatch(html, /<script>|<img src=x/);
			assert.match(html, /&lt;script(?:&gt;|>)/);
			assert.match(html, /href="\/shop\/test"/);
		});

		await t.test('blank optional shop fields hide their content', () => {
			const html = renderShop(collection(), shopSettings({ intro: '', banner: null, notice: '' }));
			assert.match(html, /<h1\b[^>]*>Shop<\/h1>/);
			assert.doesNotMatch(html, /games-bg\.jpg|Items selected for public sale\./);
			assert.doesNotMatch(html, /role="(?:status|note|alert)"/);
			assert.match(html, /href="\/shop\/test"/);
		});

		await t.test('booking detail uses the shared purchase design and a separate cart', () => {
			const value = product({
				title: 'Reservation deposit',
				handle: 'private-booking',
				availableForSale: true,
				variants: [variant({ availableForSale: true })]
			});
			const html = renderBooking(value);
			assert.match(html, /Reservation deposit/);
			assert.match(html, /Reservation booking/);
			assert.match(html, /href="\/bookings\/cart"/);
			assert.doesNotMatch(html, /href="\/bookings"|href="\/shop(?:\/|"|\?)/);
			assert.match(html, /href="\/contact"/);
			assert.match(formByAction(html, 'add'), /method="POST"/);
			assert.doesNotMatch(
				buttons(html).find((button) => button.includes('Add to cart')),
				/\sdisabled(?:\s|=|>)/
			);
		});

		await t.test(
			'booking cart links stay in the booking flow and the empty state has no catalogue',
			() => {
				const html = renderBookingCart(cart());
				assert.match(html, /Your booking cart/);
				assert.match(html, /href="\/bookings\/test"/);
				assert.doesNotMatch(html, /href="\/shop(?:\/|"|\?)/);
				assert.match(formByAction(html, 'checkout'), /method="POST"/);
				const empty = renderBookingCart(null);
				assert.match(empty, /Open the booking link we sent you/);
				assert.doesNotMatch(empty, /href="\/bookings"|href="\/shop(?:\/|"|\?)/);
				assert.equal(formByAction(empty, 'checkout'), undefined);
			}
		);

		await t.test('booking text is escaped and unavailable bookings cannot be added', () => {
			const html = renderBooking(
				product({ title: '<script>private</script>', description: '<img src=x onerror=alert(1)>' })
			);
			assert.doesNotMatch(html, /<script>|<img src=x/);
			assert.match(html, /&lt;script(?:&gt;|>)/);
			assert.match(
				buttons(html).find((button) => button.includes('Sold out')),
				/\sdisabled(?:\s|=|>)/
			);
		});

		await t.test('availability changes have a persistent polite status region', () => {
			for (const available of [false, true]) {
				const html = renderProduct(
					product({
						availableForSale: available,
						variants: [
							variant({ availableForSale: available, title: 'Evening' }),
							variant({ id: 'gid://shopify/ProductVariant/9', title: 'Morning' })
						]
					})
				);
				assert.match(html, /role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
				assert.match(html, available ? /Evening is available/ : /Sold out/);
			}
		});

		await t.test('the public cart is noindex while the booking cart head stays separate', () => {
			const props = { data: { cart: null, notice: null, checkoutBlocked: true }, form: null };
			assert.match(render(Cart, { props }).head, /name="robots" content="noindex, nofollow"/);
			assert.equal(render(BookingCart, { props }).head, '');
		});

		await t.test('an empty booking cart can return to its revalidated booking', () => {
			const html = renderBookingCart(null, { returnHandle: 'private-booking' });
			assert.match(html, /href="\/bookings\/private-booking"/);
			assert.match(html, /Back to booking/);
			assert.doesNotMatch(html, /Open the booking link we sent you/);
			assert.equal(formByAction(html, 'checkout'), undefined);
		});

		await t.test(
			'a temporary stock failure keeps removal and shows a temporary checkout reason',
			() => {
				const html = renderBookingCart(cart(), {
					checkoutBlocked: true,
					checkoutMessage: 'Stock could not be checked. Reload the cart.'
				});
				assert.match(html, /Stock could not be checked/);
				assert.ok(formByAction(html, 'remove'));
				assert.match(formByAction(html, 'checkout'), /<button\b[^>]*\sdisabled(?:\s|=|>)/);
				assert.doesNotMatch(html, /An item is no longer available/);
			}
		);

		await t.test('an old large cart line can be reduced within the form limit', () => {
			const value = cart();
			value.lines[0].quantity = 120;
			const html = renderCart(value, { checkoutBlocked: true });
			assert.match(html, /This cart has 120 of this option/);
			assert.match(formByAction(html, 'update'), /max="99"[^>]*value="99"/);
			assert.ok(formByAction(html, 'remove'));
		});

		await t.test('sold-out Test stays visible and cannot be added', () => {
			const list = renderShop(collection());
			assert.match(list, /href="\/shop\/test"/);
			assert.match(list, /Sold out/);
			assert.match(list, /\$100\.00/);
			const detail = renderProduct(product());
			const addButton = buttons(detail).find((button) => button.includes('Sold out'));
			assert.ok(addButton);
			assert.match(addButton, /\sdisabled(?:\s|=|>)/);
			assert.match(detail, /name="quantity"[^>]*min="1"[^>]*max="99"[^>]*\sdisabled(?:\s|=|>)/);
		});

		await t.test('available variant uses its current price and purchase identifier', () => {
			const detail = renderProduct(
				product({
					availableForSale: true,
					variants: [variant({ availableForSale: true, price: money('47.60') })]
				})
			);
			assert.match(detail, /\$47\.60/);
			assert.match(detail, /name="variantId" value="gid:\/\/shopify\/ProductVariant\/2"/);
			const addButton = buttons(detail).find((button) => button.includes('Add to cart'));
			assert.ok(addButton);
			assert.doesNotMatch(addButton, /\sdisabled(?:\s|=|>)/);
			assert.match(formByAction(detail, 'add'), /method="POST"/);
		});

		await t.test('product text and action errors are escaped', () => {
			const text = '<img src=x onerror=alert(1)><script>alert(2)</script>';
			const detail = renderProduct(product({ description: text, title: text }), { message: text });
			assert.doesNotMatch(detail, /<script>|<img src=x/);
			assert.match(detail, /&lt;script(?:&gt;|>)/);
			assert.match(detail, /role="alert"/);
			assert.doesNotMatch(renderShop(collection({ description: text })), /<script>|<img src=x/);
		});

		await t.test('collection cursor is encoded and empty collection has no sale link', () => {
			const list = renderShop(
				collection({ pageInfo: { hasNextPage: true, endCursor: 'cursor+/=?&' } })
			);
			assert.match(list, /href="\/shop\?after=cursor%2B%2F%3D%3F%26"/);
			const empty = renderShop(collection({ products: [] }));
			assert.match(empty, /There are no items in the shop/);
			assert.doesNotMatch(empty, /href="\/shop\/test"/);
		});

		await t.test('cart shows Shopify quantity and subtotal without rebuilding the price', () => {
			const html = renderCart(cart());
			assert.match(html, /name="quantity"[^>]*min="1"[^>]*max="99"[^>]*value="2"/);
			assert.match(html, /\$13\.25/);
			assert.match(html, /\$25\.50/);
			assert.doesNotMatch(html, /\$26\.50/);
			assert.match(
				formByAction(html, 'update'),
				/name="lineId" value="gid:\/\/shopify\/CartLine\/3"/
			);
			assert.match(
				formByAction(html, 'remove'),
				/name="lineId" value="gid:\/\/shopify\/CartLine\/3"/
			);
		});

		await t.test('blocked cart gives a direct reason and disables checkout', () => {
			const html = renderCart(cart(), { checkoutBlocked: true, notice: 'Stock has changed.' });
			assert.match(html, /An item is no longer available\. Remove it before checkout\./);
			assert.match(html, /Stock has changed\./);
			assert.match(formByAction(html, 'checkout'), /<button\b[^>]*\sdisabled(?:\s|=|>)/);
		});

		await t.test('empty cart has no checkout form; allowed checkout uses native POST', async () => {
			assert.equal(formByAction(renderCart(null), 'checkout'), undefined);
			assert.equal(
				formByAction(renderCart(cart({ totalQuantity: 0, lines: [] })), 'checkout'),
				undefined
			);
			const html = renderCart(cart());
			const checkout = formByAction(html, 'checkout');
			assert.ok(checkout);
			assert.match(checkout, /method="POST"/);
			assert.doesNotMatch(checkout, /\sdisabled(?:\s|=|>)/);
			// SSR does not run actions. Check the source to guard the external 303 handoff.
			const source = await readFile(
				path.join(root, 'src/lib/components/ShopCartView.svelte'),
				'utf8'
			);
			const checkoutTag = source.match(/<form\b[^>]*action="\?\/checkout"[^>]*>/)?.[0];
			assert.ok(checkoutTag);
			assert.doesNotMatch(checkoutTag, /use:enhance/);
		});
	} finally {
		await server.close();
		if (hmrServer.listening) await new Promise((resolve) => hmrServer.close(resolve));
	}
});
