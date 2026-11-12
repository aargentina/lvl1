// These tests use local responses. They do not call a service.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
let server;
let handle;
let privacy;
let hmrServer;

before(async () => {
	hmrServer = createHttpServer();
	await new Promise((resolve) => hmrServer.listen(0, '127.0.0.1', resolve));
	server = await createServer({
		root,
		configFile: false,
		cacheDir: fileURLToPath(
			new URL('../node_modules/.vite-booking-privacy-tests', import.meta.url)
		),
		resolve: { alias: { $lib: fileURLToPath(new URL('../src/lib', import.meta.url)) } },
		server: {
			host: '127.0.0.1',
			middlewareMode: true,
			watch: null,
			hmr: { port: 0, server: hmrServer }
		}
	});
	[{ handle }, privacy] = await Promise.all([
		server.ssrLoadModule('/src/hooks.server.ts'),
		server.ssrLoadModule('/src/lib/booking-privacy.ts')
	]);
});

after(async () => {
	await server?.close();
	if (hmrServer?.listening) await new Promise((resolve) => hmrServer.close(resolve));
});

function requestEvent(path, method = 'GET') {
	const url = new URL(path, 'https://www.levelonegamepub.com');
	return { url, request: new Request(url, { method }) };
}

test('booking path checks cover the root, child routes and data URLs only', () => {
	for (const path of [
		'/bookings',
		'/bookings/',
		'/bookings/event',
		'/bookings/cart',
		'/bookings/event/__data.json',
		'/%62ookings/event',
		'/bookings%2fevent',
		'/%62ookings/%zz',
		'/bookings%zz/event'
	]) {
		assert.equal(privacy.isBookingPath(path), true, path);
	}
	for (const path of [
		'/',
		'/shop',
		'/booking',
		'/bookings-other',
		'/bookings2/cart',
		'/other/bookings/event',
		'/%62ookings-other',
		'/bookings%2Dother',
		'/bookings%32/cart',
		'/%2562ookings/event'
	]) {
		assert.equal(privacy.isBookingPath(path), false, path);
	}
});

test('resolved booking page, action, error and data responses always have privacy headers', async () => {
	const cases = [
		['GET', '/bookings/event', 200],
		['HEAD', '/bookings/event', 200],
		['POST', '/bookings/cart', 303],
		['POST', '/bookings/event', 403],
		['POST', '/bookings/cart', 409],
		['GET', '/bookings/missing', 404],
		['GET', '/bookings', 404],
		['PUT', '/bookings/event', 405],
		['GET', '/bookings/event', 500],
		['GET', '/bookings/event', 503],
		['GET', '/bookings/event/__data.json', 200],
		['GET', '/bookings/missing/__data.json', 404],
		['GET', '/%62ookings/event', 200],
		['GET', '/bookings%2Fevent', 200],
		['GET', '/%62ookings/%zz', 400],
		['GET', '/bookings%zz/event', 400]
	];
	for (const [method, path, status] of cases) {
		const event = requestEvent(path, method);
		const expectedBody = method === 'HEAD' || status === 303 ? null : 'Fixture response';
		const original = new Response(expectedBody, {
			status,
			headers: {
				'Content-Type': 'text/plain',
				'Cache-Control': 'public, max-age=3600',
				'X-Robots-Tag': 'index, follow',
				'Referrer-Policy': 'unsafe-url',
				...(status === 303
					? { Location: 'https://checkout.levelonegamepub.com/cart/c/fixture' }
					: {})
			}
		});
		const result = await handle({ event, resolve: async () => original });
		assert.equal(result.status, status, `${method} ${path}`);
		assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
		assert.equal(result.headers.get('X-Robots-Tag'), 'noindex, nofollow, nosnippet, noimageindex');
		assert.equal(result.headers.get('Referrer-Policy'), 'strict-origin');
		assert.equal(result.headers.get('Content-Type'), 'text/plain');
		assert.equal(await result.text(), expectedBody ?? '');
		if (status === 303)
			assert.equal(result.headers.get('Location'), original.headers.get('Location'));
	}
});

test('booking headers can be added to an immutable response', async () => {
	const original = Response.redirect('https://www.levelonegamepub.com/bookings/cart', 303);
	assert.throws(() => original.headers.set('X-Test', 'value'));
	const result = await handle({
		event: requestEvent('/bookings/event', 'POST'),
		resolve: async () => original
	});
	assert.equal(result.status, 303);
	assert.equal(result.headers.get('X-Robots-Tag'), privacy.BOOKING_ROBOTS);
	assert.equal(result.headers.get('Location'), 'https://www.levelonegamepub.com/bookings/cart');
});

test('public and prefix-lookalike responses keep their current headers and response', async () => {
	for (const path of [
		'/',
		'/shop',
		'/bookings-other',
		'/bookings2/cart',
		'/other/bookings/event'
	]) {
		const original = new Response('Public page', {
			headers: { 'Cache-Control': 'public, max-age=60' }
		});
		const result = await handle({ event: requestEvent(path), resolve: async () => original });
		assert.equal(result, original);
		assert.equal(result.headers.get('Cache-Control'), 'public, max-age=60');
		assert.equal(result.headers.has('X-Robots-Tag'), false);
		assert.equal(result.headers.has('Referrer-Policy'), false);
	}
});

test('analytics drops booking page views and custom events, including query strings', () => {
	for (const type of ['pageview', 'event']) {
		for (const url of [
			'https://www.levelonegamepub.com/bookings',
			'https://www.levelonegamepub.com/bookings/event?private=fixture',
			'/bookings/cart',
			'/bookings/event/__data.json',
			'/%62ookings/event',
			'/bookings%2Fevent',
			'/%62ookings/%zz'
		])
			assert.equal(privacy.filterBookingAnalytics({ type, url }), null);
	}
});

test('analytics keeps public events unchanged when a query only mentions bookings', () => {
	for (const url of [
		'https://www.levelonegamepub.com/',
		'https://www.levelonegamepub.com/shop?return=/bookings/event',
		'/bookings-other',
		'/other/bookings/event'
	]) {
		const event = { type: 'pageview', url };
		assert.equal(privacy.filterBookingAnalytics(event), event);
	}
});
