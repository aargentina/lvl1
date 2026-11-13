// The real root layout renders with local stores and components. No service is called.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createHttpServer } from 'node:http';
import { test } from 'node:test';
import { createServer } from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { compile } from 'svelte/compiler';

const root = fileURLToPath(new URL('../', import.meta.url));
const storesId = '\0booking-head-stores';
const environmentId = '\0booking-head-environment';
const prismicId = '\0booking-head-prismic';
const previewId = '\0booking-head-preview';
const previewMarkerId = '\0booking-head-preview-marker';
const analyticsId = '\0booking-head-analytics';
const navigationId = '\0booking-head-navigation';
const wrapperId = path.join(root, '__booking-head-test-wrapper.js').replaceAll('\\', '/');
const privateData = {
	title: 'Private booking title sentinel',
	meta_title: 'Private booking Open Graph sentinel',
	meta_description: 'Private booking description sentinel',
	meta_image: { url: 'https://cdn.shopify.com/private-booking-image-sentinel.jpg' }
};

test('the root layout keeps booking details out of head data and preserves public SEO', async (t) => {
	const sources = new Map([
		[storesId, "import { writable } from 'svelte/store'; export const page = writable({});"],
		[environmentId, 'export const dev = false;'],
		[prismicId, "export const repositoryName = 'local-fixture';"],
		[navigationId, 'export function beforeNavigate() {}'],
		[previewId, `export { default as PrismicPreview } from ${JSON.stringify(previewMarkerId)};`],
		[
			previewMarkerId,
			compile(
				'<svelte:head><meta name="prismic-toolbar-fixture" content="loaded" /></svelte:head>',
				{
					generate: 'server',
					filename: 'preview-marker.svelte'
				}
			).js.code
		],
		[
			analyticsId,
			'export const injections = []; export function inject(options) { injections.push(options); }'
		],
		[
			wrapperId,
			compile(
				`<script>import Layout from './src/routes/+layout.svelte';</script>
			<Layout><section data-testid="booking-body-fixture">Direct booking content</section></Layout>`,
				{ generate: 'server', filename: wrapperId }
			).js.code
		]
	]);
	const hmrServer = createHttpServer();
	await new Promise((resolve) => hmrServer.listen(0, '127.0.0.1', resolve));
	let server;
	try {
		server = await createServer({
			root,
			configFile: false,
			cacheDir: path.join(root, 'node_modules/.vite-booking-head-tests'),
			plugins: [
				{
					name: 'booking-head-local-fixtures',
					resolveId(id) {
						return sources.has(id) ? id : null;
					},
					load(id) {
						return sources.get(id) ?? null;
					}
				},
				svelte({ configFile: false, preprocess: vitePreprocess(), hot: false })
			],
			resolve: {
				alias: [
					{ find: '$app/stores', replacement: storesId },
					{ find: '$app/navigation', replacement: navigationId },
					{ find: '$app/environment', replacement: environmentId },
					{ find: '$lib/prismicio', replacement: prismicId },
					{ find: '@prismicio/svelte/kit', replacement: previewId },
					{ find: '@vercel/analytics', replacement: analyticsId },
					{ find: '$lib', replacement: path.join(root, 'src/lib') }
				]
			},
			server: {
				host: '127.0.0.1',
				middlewareMode: true,
				hmr: { port: 0, server: hmrServer },
				watch: null
			},
			ssr: { noExternal: ['svelte'] },
			optimizeDeps: { noDiscovery: true, include: [] }
		});
		const { render } = await server.ssrLoadModule('svelte/server');
		const { page } = await server.ssrLoadModule(storesId);
		const { injections } = await server.ssrLoadModule(analyticsId);
		const { default: Wrapper } = await server.ssrLoadModule(wrapperId);
		const renderPage = (pathname, data = {}, status = 200) => {
			page.set({
				url: new URL(pathname, 'https://www.levelonegamepub.com'),
				status,
				data: {
					links: [
						{ label: 'Menu', href: '/select' },
						{ label: 'Shop', href: '/shop' }
					],
					...data
				}
			});
			return render(Wrapper);
		};
		function checkMainFormat(body) {
			assert.match(body, /<nav\b[^>]*aria-label="Main"/);
			assert.match(body, /alt="Level One Game Pub"/);
			assert.match(body, /<main\b[^>]*>[\s\S]*data-testid="booking-body-fixture"/);
			assert.match(body, /<footer\b/);
			assert.match(body, /Find Us/);
			assert.match(body, /14 Waller St/);
		}
		function checkBookingHead(head) {
			assert.match(head, /<title>Booking \| Level One Game Pub<\/title>/);
			assert.match(
				head,
				/<meta name="robots" content="noindex, nofollow, nosnippet, noimageindex"/
			);
			assert.doesNotMatch(head, /rel="canonical"|og:|twitter:|application\/ld\+json/);
			assert.doesNotMatch(head, /Private booking|private-booking-image-sentinel/);
			assert.doesNotMatch(head, /name="description"/);
			assert.doesNotMatch(head, /prismic-toolbar-fixture/);
		}

		await t.test('booking product, cart and encoded paths suppress all supplied SEO fields', () => {
			for (const pathname of [
				'/bookings/private-fixture',
				'/bookings/cart',
				'/%62ookings/private-fixture',
				'/bookings%2Fprivate-fixture'
			]) {
				const result = renderPage(pathname, privateData);
				checkBookingHead(result.head);
				checkMainFormat(result.body);
			}
		});
		await t.test('booking 404 keeps a generic title even when load data is absent or stale', () => {
			for (const data of [{}, privateData]) {
				const result = renderPage('/bookings/missing', data, 404);
				checkBookingHead(result.head);
				checkMainFormat(result.body);
			}
		});
		await t.test('public metadata remains present and LocalBusiness JSON-LD is valid JSON', () => {
			const result = renderPage('/shop', {
				title: 'Public shop title',
				meta_title: 'Public shop social title',
				meta_description: 'Public shop description',
				meta_image: { url: 'https://example.test/public-image.jpg' }
			});
			assert.match(result.head, /<title>Public shop title<\/title>/);
			assert.match(result.head, /prismic-toolbar-fixture/);
			assert.match(result.head, /rel="canonical" href="https:\/\/levelonegamepub.com\/shop"/);
			assert.match(result.head, /property="og:title" content="Public shop social title"/);
			assert.match(result.head, /property="og:description" content="Public shop description"/);
			assert.match(
				result.head,
				/name="twitter:image" content="https:\/\/example.test\/public-image.jpg"/
			);
			assert.doesNotMatch(result.head, /name="robots"/);
			const scripts = [
				...result.head.matchAll(
					/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
				)
			];
			assert.equal(scripts.length, 1);
			const schema = JSON.parse(scripts[0][1]);
			assert.equal(schema['@context'], 'https://schema.org');
			assert.equal(schema['@type'], 'LocalBusiness');
			assert.equal(schema.name, 'Level One Game Pub');
			assert.equal(schema.url, 'https://levelonegamepub.com');
			assert.equal(schema.address.addressLocality, 'Ottawa');
			checkMainFormat(result.body);
		});
		await t.test('a public prefix lookalike keeps its normal metadata', () => {
			const result = renderPage('/bookings-other', { title: 'Public page' });
			assert.match(result.head, /<title>Public page<\/title>/);
			assert.match(result.head, /rel="canonical"/);
			assert.doesNotMatch(result.head, /name="robots"/);
		});
		await t.test('the actual layout installs the booking analytics filter', () => {
			assert.ok(injections.length);
			const filter = injections.at(-1).beforeSend;
			assert.equal(typeof filter, 'function');
			assert.equal(
				filter({ type: 'pageview', url: 'https://www.levelonegamepub.com/%62ookings/private' }),
				null
			);
			const publicEvent = { type: 'pageview', url: 'https://www.levelonegamepub.com/shop' };
			assert.equal(filter(publicEvent), publicEvent);
		});
	} finally {
		await server?.close();
		await new Promise((resolve) => hmrServer.close(resolve));
	}
});
