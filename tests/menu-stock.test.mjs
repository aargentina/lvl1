// All requests use local fixtures. No network call or service token is used.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

globalThis.__stockFixtureEnv = {};
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === '$env/dynamic/private') {
			return {
				url: 'data:text/javascript,export const env=globalThis.__stockFixtureEnv',
				shortCircuit: true
			};
		}
		if (specifier === '@sveltejs/kit') {
			return {
				url: 'data:text/javascript,export const json=(body,options)=>Response.json(body,options)',
				shortCircuit: true
			};
		}
		if (specifier === '$lib/menuStock') {
			return { url: new URL('../src/lib/menuStock.ts', import.meta.url).href, shortCircuit: true };
		}
		return nextResolve(specifier, context);
	}
});

const { GET } = await import('../src/routes/api/menu-stock/+server.ts');
const { isMenuStockPayload, isFreshStockCheck, websiteMenuKey } = await import(
	'../src/lib/menuStock.ts'
);

const good = () => ({
	ok: true,
	stockCheckedAt: new Date().toISOString(),
	items: [
		{
			key: 'fish-and-chips',
			name: 'Fish & Chips',
			unavailable: false,
			isNew: true,
			source: 'toast'
		}
	]
});

test('stock payload accepts strict NEW and availability values', () => {
	assert.equal(isMenuStockPayload(good()), true);
	assert.equal(
		isMenuStockPayload({ ...good(), items: [{ ...good().items[0], isNew: 'yes' }] }),
		false
	);
	assert.equal(
		isMenuStockPayload({ ...good(), items: [{ ...good().items[0], unavailable: 'no' }] }),
		false
	);
	assert.equal(websiteMenuKey('Fish & Chips'), 'fish-and-chips');
});

test('stock payload rejects old and future snapshots', () => {
	const now = Date.now();
	assert.equal(isFreshStockCheck(new Date(now - 45 * 60_000).toISOString(), now), true);
	assert.equal(isFreshStockCheck(new Date(now - 45 * 60_000 - 1).toISOString(), now), false);
	assert.equal(isFreshStockCheck(new Date(now + 60_001).toISOString(), now), false);
});

test('proxy requires settings and does not return its token', async (t) => {
	t.mock.method(console, 'error', () => {});
	const env = globalThis.__stockFixtureEnv;
	delete env.DASHBOARD_STOCK_API_URL;
	delete env.DASHBOARD_STOCK_API_TOKEN;
	assert.equal((await GET({ fetch: async () => Response.json(good()) })).status, 503);

	Object.assign(env, {
		DASHBOARD_STOCK_API_URL: 'https://fixture.invalid/menu-stock',
		DASHBOARD_STOCK_API_TOKEN: 'fixture-token'
	});
	const result = await GET({
		fetch: async (_url, init) => {
			assert.equal(init.headers.Authorization, 'Bearer fixture-token');
			assert.equal(init.cache, 'no-store');
			return Response.json(good());
		}
	});
	assert.equal(result.status, 200);
	assert.equal(result.headers.get('cache-control'), 'public, max-age=0, s-maxage=15');
	assert.equal((await result.text()).includes('fixture-token'), false);
});

test('proxy rejects bad upstream results', async (t) => {
	t.mock.method(console, 'error', () => {});
	Object.assign(globalThis.__stockFixtureEnv, {
		DASHBOARD_STOCK_API_URL: 'https://fixture.invalid/menu-stock',
		DASHBOARD_STOCK_API_TOKEN: 'fixture-token'
	});
	for (const fetch of [
		async () => new Response('', { status: 401 }),
		async () => Response.json({ ...good(), items: [null] }),
		async () => Response.json({ ...good(), stockCheckedAt: null }),
		async () => {
			throw new Error('fixture failure');
		}
	]) {
		assert.equal((await GET({ fetch })).status, 503);
	}
});
