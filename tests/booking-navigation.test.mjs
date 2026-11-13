import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const root = fileURLToPath(new URL('../', import.meta.url));
let server, hmrServer, crossesBookingBoundary;
before(async () => {
	hmrServer = createHttpServer();
	await new Promise((resolve) => hmrServer.listen(0, '127.0.0.1', resolve));
	server = await createServer({
		root,
		configFile: false,
		cacheDir: fileURLToPath(
			new URL('../node_modules/.vite-booking-navigation-tests', import.meta.url)
		),
		server: { middlewareMode: true, hmr: { server: hmrServer }, watch: null }
	});
	({ crossesBookingBoundary } = await server.ssrLoadModule('/src/lib/booking-navigation.ts'));
});
after(async () => {
	await server?.close();
	if (hmrServer?.listening) await new Promise((resolve) => hmrServer.close(resolve));
});
const url = (path) => new URL(path, 'https://www.levelonegamepub.com');
test('crossing the public and booking boundary needs a new document', () => {
	for (const [from, to] of [
		['/shop', '/bookings/test'],
		['/preview/contact', '/bookings/test'],
		['/bookings/cart', '/shop'],
		['/shop', '/%62ookings/test']
	]) {
		assert.equal(crossesBookingBoundary(url(from), url(to)), true);
	}
});
test('normal internal navigation and unrelated hosts do not force a reload', () => {
	for (const [from, to] of [
		['/shop', '/contact'],
		['/bookings/test', '/bookings/cart'],
		['/shop', '/bookings-other'],
		['/shop', 'https://other.invalid/bookings/test']
	]) {
		assert.equal(crossesBookingBoundary(url(from), url(to)), false);
	}
});
