// Prismic reads use local fixtures. These checks do not call a remote service.
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { PreviewTokenExpiredError } from '@prismicio/client';

const root = fileURLToPath(new URL('../', import.meta.url));
const previewSdkModule = '\0shop-settings-preview-sdk';
const prismicClientModule = '\0shop-settings-prismic-client';
let server;
let hmrServer;
let loadShopSettings;
let previewRoute;
let previewSdk;
let prismicClient;

before(async () => {
	hmrServer = createHttpServer();
	await new Promise((resolve) => hmrServer.listen(0, '127.0.0.1', resolve));
	server = await createServer({
		root,
		configFile: false,
		cacheDir: fileURLToPath(new URL('../node_modules/.vite-shop-settings-tests', import.meta.url)),
		resolve: {
			alias: [
				{ find: '@prismicio/svelte/kit', replacement: previewSdkModule },
				{ find: /^\$lib\/prismicio(?:\.js)?$/, replacement: prismicClientModule },
				{ find: '$lib', replacement: fileURLToPath(new URL('../src/lib', import.meta.url)) }
			]
		},
		plugins: [
			{
				name: 'shop-settings-preview-local-fixtures',
				resolveId(id) {
					return [previewSdkModule, prismicClientModule].includes(id) ? id : null;
				},
				load(id) {
					if (id === previewSdkModule)
						return `export let response; export const calls = [];
						export function setResponse(value) { response = value; }
						export async function redirectToPreviewURL(config) {
							calls.push(config);
							config.cookies.set('io.prismic.preview', 'local-preview-cookie', { path: '/', httpOnly: false });
							return response;
						}`;
					if (id === prismicClientModule)
						return `export const calls = []; export const client = {};
						export function createClient(config) { calls.push(config); return client; }`;
				}
			}
		],
		server: { host: '127.0.0.1', middlewareMode: true, watch: null, hmr: { server: hmrServer } }
	});
	({ loadShopSettings } = await server.ssrLoadModule('/src/lib/server/shop-settings.ts'));
	previewRoute = await server.ssrLoadModule('/src/routes/api/preview/+server.ts');
	previewSdk = await server.ssrLoadModule(previewSdkModule);
	prismicClient = await server.ssrLoadModule(prismicClientModule);
});

after(async () => {
	await server?.close();
	if (hmrServer?.listening) await new Promise((resolve) => hmrServer.close(resolve));
});

const banner = {
	id: 'shop-banner-fixture',
	url: 'https://images.prismic.io/lvl1/shop-banner-fixture.jpg?auto=format,compress',
	alt: 'Games at Level One',
	dimensions: { width: 1600, height: 600 }
};

function client(data, failure) {
	const calls = [];
	const requests = [];
	return {
		calls,
		requests,
		async getSingle(type, options) {
			calls.push(type);
			requests.push(options);
			if (failure) throw failure;
			return data === undefined ? null : { data };
		}
	};
}

test('the shop uses current Prismic fields and reads only Shop settings', async () => {
	const source = client({
		heading: '  Games and events  ',
		intro: '  Find your next game.\nBook an event.  ',
		banner,
		notice: '  Event tickets cannot be returned.  '
	});
	assert.deepEqual(await loadShopSettings(source, 'Old collection text'), {
		heading: 'Games and events',
		intro: 'Find your next game.\nBook an event.',
		banner: { url: banner.url, alt: banner.alt },
		notice: 'Event tickets cannot be returned.'
	});
	assert.deepEqual(source.calls, ['shop_settings']);
});

test('settings reads use no-store and a separate abort signal for each request', async () => {
	const source = client({ heading: 'Shop' });
	await loadShopSettings(source, '');
	await loadShopSettings(source, '');
	for (const request of source.requests) {
		assert.equal(request.fetchOptions.cache, 'no-store');
		assert.ok(request.fetchOptions.signal instanceof AbortSignal);
		assert.equal(request.fetchOptions.signal.aborted, false);
	}
	assert.notEqual(source.requests[0].fetchOptions.signal, source.requests[1].fetchOptions.signal);
});

test('an absent document or failed Prismic read keeps the shop usable', async () => {
	const expected = {
		heading: 'Shop',
		intro: 'Items selected for public sale.',
		banner: { url: '/redesign/games-bg.jpg', alt: '' },
		notice: ''
	};
	for (const source of [client(), client(undefined, new Error('Prismic is unavailable'))]) {
		assert.deepEqual(await loadShopSettings(source, expected.intro), expected);
		assert.equal(source.calls.length, 1);
	}
	assert.equal((await loadShopSettings(client(), '')).intro, 'Shop items from Level One Game Pub.');
});

test('an existing document can hide its intro, banner and notice', async () => {
	assert.deepEqual(
		await loadShopSettings(
			client({ heading: '  ', intro: '  ', banner: {}, notice: '  ' }),
			'Do not show this collection text'
		),
		{ heading: 'Shop', intro: '', banner: null, notice: '' }
	);
});

test('expired settings preview reads published settings and clears only its preview cookie', async () => {
	let published = false;
	const deletes = [],
		requests = [];
	const source = {
		disableAutoPreviews() {},
		queryLatestContent() {
			published = true;
		},
		async getSingle(type, options) {
			requests.push({ type, options });
			if (!published) throw new PreviewTokenExpiredError('Expired local fixture', undefined, {});
			return {
				data: { heading: 'Published shop', intro: 'Published intro', banner: {}, notice: '' }
			};
		}
	};
	const result = await loadShopSettings(source, 'Old fallback', {
		delete: (name, options) => deletes.push({ name, options })
	});
	assert.equal(result.heading, 'Published shop');
	assert.equal(result.intro, 'Published intro');
	assert.equal(requests.length, 2);
	assert.equal(requests[0].options.fetchOptions.signal, requests[1].options.fetchOptions.signal);
	assert.deepEqual(deletes, [{ name: 'io.prismic.preview', options: { path: '/' } }]);
});

test('plain text survives the loader for safe rendering by Svelte', async () => {
	const text = '<img src=x onerror=alert(1)><script>alert(2)</script>';
	const settings = await loadShopSettings(
		client({ heading: text, intro: text, banner: { ...banner, alt: text }, notice: text }),
		''
	);
	assert.equal(settings.heading, text);
	assert.equal(settings.intro, text);
	assert.equal(settings.notice, text);
	assert.equal(settings.banner.alt, text);
});

test('empty and unsafe banner values do not become image sources', async () => {
	for (const value of [
		null,
		{},
		{ url: '' },
		{ url: 'javascript:alert(1)' },
		{ url: 'data:image/svg+xml,<svg onload="alert(1)" />' },
		{ url: 'http://images.prismic.io/lvl1/image.jpg' },
		{ url: 'https://user:secret@images.prismic.io/lvl1/image.jpg' },
		{ url: 'https://images.prismic.io:8443/lvl1/image.jpg' },
		{ url: 'https://example.invalid/shop-banner.jpg' },
		{ url: 'https://images.prismic.io.example.invalid/shop-banner.jpg' }
	]) {
		const settings = await loadShopSettings(client({ heading: 'Shop', banner: value }), '');
		assert.equal(settings.banner, null);
	}
});

test('Prismic CDN images are accepted with empty alt text when none is set', async () => {
	const url = 'https://lvl1.cdn.prismic.io/lvl1/shop-banner-fixture.jpg';
	const settings = await loadShopSettings(client({ banner: { url } }), '');
	assert.deepEqual(settings.banner, { url, alt: '' });
});

function previewEvent() {
	const cookieWrites = [];
	return {
		fetch: async () => {
			throw new Error('A preview test must not call a remote service.');
		},
		request: new Request('https://www.levelonegamepub.com/api/preview?documentId=local-fixture'),
		cookies: { set: (...args) => cookieWrites.push(args) },
		cookieWrites
	};
}

test('Shop settings preview opens the shop and preserves the SDK response and cookie', async () => {
	const sdkResponse = new Response('Preview redirect body', {
		status: 307,
		headers: { Location: '/preview/shop', 'X-Preview-Test': 'preserved' }
	});
	previewSdk.setResponse(sdkResponse);
	const input = previewEvent();
	const result = await previewRoute.GET(input);
	assert.equal(result.status, sdkResponse.status);
	assert.equal(result.headers.get('location'), '/shop');
	assert.equal(result.headers.get('x-preview-test'), 'preserved');
	assert.equal(await result.text(), 'Preview redirect body');
	assert.deepEqual(input.cookieWrites, [
		['io.prismic.preview', 'local-preview-cookie', { path: '/', httpOnly: false }]
	]);
	const sdkOptions = previewSdk.calls.at(-1);
	assert.equal(sdkOptions.request, input.request);
	assert.equal(sdkOptions.cookies, input.cookies);
	assert.equal(sdkOptions.client, prismicClient.client);
	assert.equal(prismicClient.calls.at(-1).fetch, input.fetch);
});

test('existing page previews and shop lookalikes keep their SDK destination', async () => {
	for (const location of [
		'/preview/',
		'/preview/contact',
		'/preview/shop-other',
		'/preview/shop/',
		'/preview/shop?mode=other'
	]) {
		const sdkResponse = new Response(null, { status: 307, headers: { Location: location } });
		previewSdk.setResponse(sdkResponse);
		const input = previewEvent();
		const result = await previewRoute.GET(input);
		assert.equal(result, sdkResponse);
		assert.equal(result.headers.get('location'), location);
		assert.deepEqual(input.cookieWrites, [
			['io.prismic.preview', 'local-preview-cookie', { path: '/', httpOnly: false }]
		]);
	}
});
