// All CMS responses are local fixtures. No provider is called.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { cookie, PreviewTokenExpiredError } from '@prismicio/client';

const root = fileURLToPath(new URL('../', import.meta.url));
const clientId = '\0prismic-recovery-client';
const environmentId = '\0prismic-recovery-environment';
const previewSdkId = '\0prismic-recovery-preview-sdk';
let server;
let hmrServer;
let readPrismic;
let layout;
let home;
let page;
let food;
let drink;
let hooks;
let fixture;
let previewRoute;
let previewSdk;

before(async () => {
	hmrServer = createHttpServer();
	await new Promise((resolve) => hmrServer.listen(0, '127.0.0.1', resolve));
	server = await createServer({
		root,
		configFile: false,
		cacheDir: fileURLToPath(
			new URL('../node_modules/.vite-prismic-recovery-tests', import.meta.url)
		),
		resolve: {
			alias: [
				{ find: '@prismicio/svelte/kit', replacement: previewSdkId },
				{ find: /^\$lib\/prismicio(?:\.js)?$/, replacement: clientId },
				{ find: '$app/environment', replacement: environmentId },
				{ find: '$lib', replacement: fileURLToPath(new URL('../src/lib', import.meta.url)) }
			]
		},
		plugins: [
			{
				name: 'prismic-recovery-local-fixtures',
				resolveId(id) {
					return [clientId, environmentId, previewSdkId].includes(id) ? id : null;
				},
				load(id) {
					if (id === environmentId) return 'export const dev = false;';
					if (id === previewSdkId)
						return `export let response; export let failure; export const calls = [];
					export function setState(nextResponse, nextFailure) { response = nextResponse; failure = nextFailure; calls.length = 0; }
					export async function redirectToPreviewURL(config) {
						calls.push(config);
						if (failure) throw failure;
						config.cookies.set('io.prismic.preview', 'valid-local-fixture', { path: '/', httpOnly: false });
						return response;
					}`;
					if (id === clientId)
						return `export let client; export const configs = [];
					export function setClient(value) { client = value; }
					export function createClient(config) { configs.push(config); return client; }`;
				}
			}
		],
		server: { host: '127.0.0.1', middlewareMode: true, watch: null, hmr: { server: hmrServer } }
	});
	({ readPrismic } = await server.ssrLoadModule('/src/lib/server/prismic-read.ts'));
	[layout, home, page, food, drink, hooks, fixture, previewRoute, previewSdk] = await Promise.all([
		server.ssrLoadModule('/src/routes/+layout.server.ts'),
		server.ssrLoadModule('/src/routes/[[preview=preview]]/+page.server.ts'),
		server.ssrLoadModule('/src/routes/[[preview=preview]]/[uid]/+page.server.ts'),
		server.ssrLoadModule('/src/routes/food/+page.server.ts'),
		server.ssrLoadModule('/src/routes/drink/+page.server.ts'),
		server.ssrLoadModule('/src/hooks.server.ts'),
		server.ssrLoadModule(clientId),
		server.ssrLoadModule('/src/routes/api/preview/+server.ts'),
		server.ssrLoadModule(previewSdkId)
	]);
});

after(async () => {
	await server?.close();
	if (hmrServer?.listening) await new Promise((resolve) => hmrServer.close(resolve));
});

function state() {
	const values = new Map([
		[cookie.preview, 'expired-local-fixture'],
		['level_one_shop_cart', 'public-cart'],
		['level_one_booking_cart', 'booking-cart']
	]);
	const deletes = [];
	const writes = [];
	const client = {
		published: false,
		disabled: false,
		disableAutoPreviews() {
			this.disabled = true;
		},
		queryLatestContent() {
			this.published = true;
		}
	};
	const cookies = {
		get: (name) => values.get(name),
		set(name, value, options) {
			writes.push({ name, value, options });
			values.set(name, value);
		},
		delete(name, options) {
			deletes.push({ name, options });
			values.delete(name);
		}
	};
	return { client, cookies, values, deletes, writes };
}

const expired = () =>
	new PreviewTokenExpiredError('This preview token has expired', undefined, {
		type: 'api_security_error',
		message: 'This preview token has expired'
	});
const content = (name) => ({
	data: { title: [{ type: 'heading1', text: name, spans: [] }], meta_image: null }
});

test('a valid preview keeps its source and cookies unchanged', async () => {
	const value = state();
	const options = [];
	const result = await readPrismic(value.client, value.cookies, async (option) => {
		options.push(option);
		return 'draft content';
	});
	assert.equal(result, 'draft content');
	assert.equal(options.length, 1);
	assert.equal(options[0].fetchOptions.cache, 'no-store');
	assert.ok(options[0].fetchOptions.signal instanceof AbortSignal);
	assert.equal(value.client.published, false);
	assert.equal(value.client.disabled, false);
	assert.deepEqual(value.deletes, []);
});

test('an expired preview clears only its cookie and retries published content once', async () => {
	const value = state();
	const options = [];
	const result = await readPrismic(value.client, value.cookies, async (option) => {
		options.push(option);
		if (!value.client.published) throw expired();
		return 'published content';
	});
	assert.equal(result, 'published content');
	assert.equal(options.length, 2);
	assert.equal(options[0].fetchOptions.signal, options[1].fetchOptions.signal);
	assert.equal(value.client.disabled, true);
	assert.deepEqual(value.deletes, [{ name: cookie.preview, options: { path: '/' } }]);
	assert.equal(value.values.get('level_one_shop_cart'), 'public-cart');
	assert.equal(value.values.get('level_one_booking_cart'), 'booking-cart');
});

test('other failures do not clear a preview or retry a read', async () => {
	for (const failure of [new Error('Unavailable'), new DOMException('Cancelled', 'AbortError')]) {
		const value = state();
		let calls = 0;
		await assert.rejects(
			readPrismic(value.client, value.cookies, async () => {
				calls++;
				throw failure;
			}),
			(cause) => cause === failure
		);
		assert.equal(calls, 1);
		assert.deepEqual(value.deletes, []);
		assert.equal(value.client.published, false);
	}
});

test('failed recovery does not repeat or extend the read deadline', async () => {
	const value = state();
	let calls = 0;
	const options = [];
	await assert.rejects(
		readPrismic(value.client, value.cookies, async (option) => {
			calls++;
			options.push(option);
			throw expired();
		}),
		PreviewTokenExpiredError
	);
	assert.equal(calls, 2);
	assert.equal(options[0].fetchOptions.signal, options[1].fetchOptions.signal);
	assert.equal(value.deletes.length, 1);
});

test('navigation has a safe fallback on service and timeout failures', async () => {
	for (const failure of [new Error('Unavailable'), new DOMException('Cancelled', 'TimeoutError')]) {
		const value = state();
		const calls = [];
		value.client.getSingle = async (type, options) => {
			calls.push({ type, options });
			throw failure;
		};
		fixture.setClient(value.client);
		const fetch = () => {
			throw new Error('Network access is not allowed');
		};
		const result = await layout.load({ fetch, cookies: value.cookies });
		assert.ok(result.links.some((link) => link.href === '/shop'));
		assert.ok(result.links.some((link) => link.href === '/contact'));
		assert.ok(
			result.links.some(
				(link) => link.href === 'https://order.toasttab.com/egiftcards/level-one-14-waller-st'
			)
		);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].type, 'navigation');
		assert.ok(calls[0].options.fetchOptions.signal instanceof AbortSignal);
		assert.deepEqual(value.deletes, []);
	}
});

test('valid CMS navigation is used and the shop link is added once', async () => {
	const value = state();
	value.client.getSingle = async () => ({
		data: {
			links: [
				{
					label: [{ type: 'heading3', text: 'Menu', spans: [] }],
					link: { link_type: 'Web', url: '/select' }
				},
				{
					label: [{ type: 'heading3', text: 'Store', spans: [] }],
					link: { link_type: 'Web', url: '/shop' }
				}
			]
		}
	});
	fixture.setClient(value.client);
	const result = await layout.load({ fetch: null, cookies: value.cookies });
	assert.deepEqual(result.links, [
		{ label: 'Menu', href: '/select' },
		{ label: 'Store', href: '/shop' }
	]);
	assert.deepEqual(value.deletes, []);
});

test('home, normal pages and both menu pages recover an expired preview using the exact UID', async () => {
	for (const [route, uid] of [
		[home, 'home'],
		[page, 'contact'],
		[food, 'food'],
		[drink, 'drink']
	]) {
		const value = state();
		const calls = [];
		value.client.getByUID = async (type, actualUid, options) => {
			calls.push({ type, uid: actualUid, options });
			if (!value.client.published) throw expired();
			return content(uid);
		};
		fixture.setClient(value.client);
		const result = await route.load({ params: { uid }, fetch: null, cookies: value.cookies });
		assert.equal(result.title, uid);
		assert.equal(calls.length, 2);
		assert.ok(calls.every((call) => call.type === 'page' && call.uid === uid));
		assert.equal(value.deletes.length, 1);
	}
});

const event = (path, method = 'GET') => {
	const url = new URL(path, 'https://www.levelonegamepub.com');
	return { url, request: new Request(url, { method }) };
};

test('Prismic-prefixed shop GET and HEAD requests use the sales route with their query', async () => {
	for (const method of ['GET', 'HEAD'])
		for (const path of ['/preview/shop', '/preview/shop/test', '/preview/shop/cart']) {
			const result = await hooks.handle({
				event: event(path + '?after=cursor%2B%2F%3D&x=1', method),
				resolve: () => {
					throw new Error('Wrong generic page loader');
				}
			});
			assert.equal(result.status, 307);
			assert.equal(
				result.headers.get('location'),
				path.slice('/preview'.length) + '?after=cursor%2B%2F%3D&x=1'
			);
			assert.equal(result.headers.get('cache-control'), 'private, no-store');
			assert.equal(result.headers.get('x-robots-tag'), 'noindex, nofollow');
			assert.equal(await result.text(), '');
		}
});

test('preview redirect has exact boundaries and does not change writes or other previews', async () => {
	for (const path of [
		'/preview/shopping',
		'/preview/shop-other',
		'/preview/contact',
		'/preview',
		'/shop',
		'/preview%2Fshop',
		'/preview//shop'
	]) {
		const response = new Response('Unchanged');
		assert.equal(
			await hooks.handle({ event: event(path), resolve: async () => response }),
			response,
			path
		);
	}
	for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
		const response = new Response('Existing method handling');
		assert.equal(
			await hooks.handle({
				event: event('/preview/shop/cart', method),
				resolve: async () => response
			}),
			response,
			method
		);
	}
});

test('preview redirect cannot use a supplied external host or scheme', async () => {
	for (const path of [
		'/preview/shop//evil.example/path',
		'/preview/shop/https://evil.example',
		'/preview/shop?next=https://evil.example'
	]) {
		const result = await hooks.handle({
			event: event(path),
			resolve: () => {
				throw new Error('Not reached');
			}
		});
		const location = new URL(result.headers.get('location'), 'https://www.levelonegamepub.com');
		assert.equal(location.origin, 'https://www.levelonegamepub.com');
		assert.ok(location.pathname.startsWith('/shop'));
	}
});

test('an expired preview callback clears only its cookie and opens published home without a retry', async () => {
	const value = state();
	fixture.setClient(value.client);
	previewSdk.setState(null, expired());
	const input = {
		fetch: () => {
			throw new Error('No network access');
		},
		cookies: value.cookies,
		request: new Request(
			'https://www.levelonegamepub.com/api/preview?token=old-fixture&returnTo=https://evil.example'
		)
	};
	const result = await previewRoute.GET(input);
	assert.equal(result.status, 303);
	assert.equal(result.headers.get('location'), '/');
	assert.equal(result.headers.get('cache-control'), 'private, no-store');
	assert.equal(result.headers.get('x-robots-tag'), 'noindex, nofollow');
	assert.equal(previewSdk.calls.length, 1);
	assert.deepEqual(value.deletes, [{ name: cookie.preview, options: { path: '/' } }]);
	assert.equal(value.values.get('level_one_shop_cart'), 'public-cart');
	assert.equal(value.values.get('level_one_booking_cart'), 'booking-cart');
	assert.deepEqual(value.writes, []);
	assert.equal(value.client.published, false);
});

test('other preview callback failures are not retried or treated as expiry', async () => {
	const value = state();
	fixture.setClient(value.client);
	const failure = new Error('Service unavailable');
	previewSdk.setState(null, failure);
	await assert.rejects(
		previewRoute.GET({
			fetch: null,
			cookies: value.cookies,
			request: new Request('https://www.levelonegamepub.com/api/preview')
		}),
		(cause) => cause === failure
	);
	assert.equal(previewSdk.calls.length, 1);
	assert.deepEqual(value.deletes, []);
	assert.deepEqual(value.writes, []);
});

test('valid preview callbacks keep their SDK state and normalize only the exact shop destination', async () => {
	for (const location of ['/preview/contact', '/preview/shop']) {
		const value = state();
		fixture.setClient(value.client);
		const response = new Response('Local SDK body', {
			status: 307,
			headers: { Location: location, 'X-Fixture': 'kept' }
		});
		previewSdk.setState(response, null);
		const result = await previewRoute.GET({
			fetch: null,
			cookies: value.cookies,
			request: new Request('https://www.levelonegamepub.com/api/preview?token=valid-fixture')
		});
		assert.equal(result.status, 307);
		assert.equal(result.headers.get('location'), location === '/preview/shop' ? '/shop' : location);
		assert.equal(result.headers.get('x-fixture'), 'kept');
		assert.equal(await result.text(), 'Local SDK body');
		assert.equal(previewSdk.calls.length, 1);
		assert.equal(value.values.get(cookie.preview), 'valid-local-fixture');
		assert.deepEqual(value.deletes, []);
		assert.equal(value.values.get('level_one_shop_cart'), 'public-cart');
	}
});
