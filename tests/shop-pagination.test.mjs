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
      export const calls=[]; let result; let failure;
      export function set(value,error){result=value;failure=error;calls.length=0}
      export function privateShopPage(event){event.setHeaders({'Cache-Control':'private, no-store'})}
      export function shopClient(){return {async collection(after){calls.push(after);if(failure)throw failure;return result}}}
      export function createClient(){return {async getSingle(){return {data:{heading:'Shop',intro:'Fixture',banner:{},notice:''}}}}}
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
