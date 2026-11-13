// Pagination recovery uses local fixtures. No provider is called.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureId = '\0shop-pagination-fixture';
let server, hmrServer, route, fixture;
before(async () => {
	hmrServer = createHttpServer();
	await new Promise((resolve) => hmrServer.listen(0, '127.0.0.1', resolve));
	server = await createServer({
		root,
		configFile: false,
		cacheDir: fileURLToPath(
			new URL('../node_modules/.vite-shop-pagination-tests', import.meta.url)
		),
		resolve: {
			alias: [
				{ find: '$lib/server/shop-session', replacement: fixtureId },
				{ find: '$lib/prismicio', replacement: fixtureId },
				{ find: '$lib', replacement: fileURLToPath(new URL('../src/lib', import.meta.url)) }
			]
		},
		plugins: [
			{
				name: 'pagination-fixture',
				resolveId(id) {
					return id === fixtureId ? id : null;
				},
				load(id) {
					if (id === fixtureId)
						return `
      export const calls=[]; let result; let failure; let collectionReader; let settingsReader;
      export function set(value,error){result=value;failure=error;calls.length=0;collectionReader=null;settingsReader=null}
      export function setReaders(collection,settings){set(null);collectionReader=collection;settingsReader=settings}
      export function privateShopPage(event){event.setHeaders({'Cache-Control':'private, no-store'})}
      export function shopClient(){return {async collection(after){calls.push(after);if(collectionReader)return collectionReader();if(failure)throw failure;return result}}}
      export function createClient(){return {async getSingle(){if(settingsReader)return settingsReader();return {data:{heading:'Shop',intro:'Fixture',banner:{},notice:''}}}}}
    `;
				}
			}
		],
		server: { host: '127.0.0.1', middlewareMode: true, watch: null, hmr: { server: hmrServer } }
	});
	[route, fixture] = await Promise.all([
		server.ssrLoadModule('/src/routes/shop/+page.server.ts'),
		server.ssrLoadModule(fixtureId)
	]);
});
after(async () => {
	await server?.close();
	if (hmrServer?.listening) await new Promise((resolve) => hmrServer.close(resolve));
});
const collection = (products = []) => ({
	title: 'Public shop',
	description: 'Fixture',
	products,
	pageInfo: { hasNextPage: false, endCursor: null }
});
function event(query = '') {
	const headers = {};
	return {
		url: new URL('/shop' + query, 'https://www.levelonegamepub.com'),
		cookies: { delete() {} },
		fetch() {
			throw Error('No external read');
		},
		setHeaders(value) {
			Object.assign(headers, value);
		},
		headers
	};
}
const firstPage = (cause) => cause.status === 303 && cause.location === '/shop';
test('an overlong cursor returns to the first page without a source read', async () => {
	fixture.set(collection());
	const input = event('?after=' + 'x'.repeat(1025));
	await assert.rejects(route.load(input), firstPage);
	assert.equal(fixture.calls.length, 0);
	assert.equal(input.headers['Cache-Control'], 'private, no-store');
});
test('a rejected cursor returns to the first page instead of an outage loop', async () => {
	fixture.set(null, new Error('Cursor is no longer valid'));
	await assert.rejects(route.load(event('?after=old-cursor')), firstPage);
	assert.deepEqual(fixture.calls, ['old-cursor']);
});
test('an exhausted cursor returns to the first page', async () => {
	fixture.set(collection());
	await assert.rejects(route.load(event('?after=old-cursor')), firstPage);
});
test('a normal empty shop stays on its first page', async () => {
	fixture.set(collection());
	const result = await route.load(event());
	assert.equal(result.collection.products.length, 0);
	assert.equal(result.shopSettings.heading, 'Shop');
});
test('a valid page keeps its products and reads the current settings', async () => {
	fixture.set(collection([{ handle: 'fixture' }]));
	const result = await route.load(event('?after=valid-cursor'));
	assert.deepEqual(result.collection.products, [{ handle: 'fixture' }]);
	assert.deepEqual(fixture.calls, ['valid-cursor']);
});
test('an initial source failure is reported rather than redirected forever', async () => {
	fixture.set(null, new Error('Source unavailable'));
	await assert.rejects(route.load(event()), (cause) => cause.status === 503);
	assert.deepEqual(fixture.calls, [null]);
});

function deferred() {
	let resolve, reject;
	const promise = new Promise((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

test('Shopify and Prismic both start before either source finishes', async () => {
	const shop = deferred(),
		settings = deferred();
	const started = [];
	fixture.setReaders(
		() => {
			started.push('Shopify');
			return shop.promise;
		},
		() => {
			started.push('Prismic');
			return settings.promise;
		}
	);
	const loading = route.load(event());
	// Run the queued source starts. Both responses remain held by this test.
	await Promise.resolve();
	try {
		assert.deepEqual(new Set(started), new Set(['Shopify', 'Prismic']));
	} finally {
		shop.resolve(collection([{ handle: 'fixture' }]));
		settings.resolve({ data: { heading: 'Current heading', intro: '', banner: {}, notice: '' } });
	}
	const result = await loading;
	assert.equal(result.shopSettings.heading, 'Current heading');
	assert.equal(result.shopSettings.intro, '');
	assert.deepEqual(result.collection.products, [{ handle: 'fixture' }]);
});

test('a failed parallel Prismic read waits for the collection description fallback', async () => {
	const shop = deferred();
	fixture.setReaders(
		() => shop.promise,
		async () => {
			throw new Error('Settings are unavailable');
		}
	);
	const loading = route.load(event());
	shop.resolve({ ...collection(), description: '  Current collection description  ' });
	const result = await loading;
	assert.equal(result.shopSettings.heading, 'Shop');
	assert.equal(result.shopSettings.intro, 'Current collection description');
	assert.deepEqual(result.shopSettings.banner, { url: '/redesign/games-bg.jpg', alt: '' });
});

test('Shopify failure keeps its status when the parallel Prismic read fails later', async () => {
	for (const query of ['', '?after=old-cursor']) {
		const shop = deferred(),
			settings = deferred();
		fixture.setReaders(
			() => shop.promise,
			() => settings.promise
		);
		const loading = route.load(event(query));
		const rejected = assert.rejects(loading, query ? firstPage : (cause) => cause.status === 503);
		shop.reject(new Error('Shopify is unavailable'));
		await rejected;
		settings.reject(new Error('Settings failed after Shopify'));
		// Let the late rejection settle. Node reports any unhandled rejection as a failure.
		await new Promise(setImmediate);
	}
});
