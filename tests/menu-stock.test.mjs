// Run with Node 24: node --experimental-strip-types --test tests/menu-stock.test.mjs
// All requests use fixtures. No service credentials or network calls are used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

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
const {
	readMenuStock,
	isMenuStockPayload,
	isFreshStockCheck,
	websiteMenuKey,
	UPSTREAM_STOCK_TIMEOUT_MS,
	CLIENT_STOCK_TIMEOUT_MS
} = await import('../src/lib/menuStock.ts');
const good = (unavailable = true) => ({
	ok: true,
	stockCheckedAt: new Date().toISOString(),
	items: [{ key: 'fixture', name: 'Fixture', unavailable, source: 'toast' }]
});
const flush = () => new Promise((resolve) => setImmediate(resolve));
const response = (body) => Response.json(body);
const deferred = () => {
	let resolve;
	const promise = new Promise((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

// Execute the actual page script with virtual mount/interval hooks and state.
// Rendering and the card-key mapping remain outside the changed code.
const source = await readFile(new URL('../src/routes/food/+page.svelte', import.meta.url), 'utf8');
let script = source.match(/<script lang="ts">([\s\S]*?)<\/script>/)[1];
const parsed = ts.createSourceFile('fixture.ts', script, ts.ScriptTarget.Latest, true);
for (const statement of [...parsed.statements].reverse()) {
	if (ts.isImportDeclaration(statement))
		script = script.slice(0, statement.pos) + script.slice(statement.end);
}
const js = ts.transpileModule(script, {
	compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
function page(fetchImpl) {
	let timer, cleanup;
	const document = { visibilityState: 'visible' };
	const context = vm.createContext({
		$state: (value) => value,
		$props: () => ({ data: { page: { data: { slices: [] } } } }),
		onMount: (run) => {
			cleanup = run();
		},
		fetch: fetchImpl,
		readMenuStock,
		CLIENT_STOCK_TIMEOUT_MS,
		window: {
			location: { search: '' },
			setInterval: (run) => {
				timer = run;
				return 1;
			},
			clearInterval: () => {}
		},
		document,
		AbortController,
		URLSearchParams,
		console: { error: () => {} }
	});
	vm.runInContext(
		js + '\nglobalThis.inspect = () => JSON.stringify({stockByKey,failedStockRefreshes});',
		context
	);
	return {
		poll: () => timer(),
		state: () => JSON.parse(context.inspect()),
		close: () => cleanup(),
		document
	};
}

test('payload: validate all rows, fresh timestamp, unique keys and strict types', () => {
	assert.equal(isMenuStockPayload(good()), true);
	assert.equal(isMenuStockPayload({ ...good(), items: [] }), true);
	for (const item of [
		null,
		{},
		{ ...good().items[0], unavailable: 'false' },
		{ ...good().items[0], key: '' },
		{ ...good().items[0], name: 1 },
		{ ...good().items[0], source: 'invalid' }
	]) {
		assert.equal(isMenuStockPayload({ ...good(), items: [good().items[0], item] }), false);
	}
	for (const value of [
		null,
		[],
		{ ...good(), ok: 'true' },
		{ ...good(), checkedAt: 123 },
		{ ...good(), items: [good().items[0], good().items[0]] },
		{ ...good(), stockCheckedAt: null },
		{ ...good(), stockCheckedAt: new Date(Date.now() - 46 * 60_000).toISOString() }
	]) {
		assert.equal(isMenuStockPayload(value), false);
	}
	const now = Date.now();
	assert.equal(isFreshStockCheck(new Date(now - 45 * 60_000).toISOString(), now), true);
	assert.equal(isFreshStockCheck(new Date(now - 45 * 60_000 - 1).toISOString(), now), false);
	assert.equal(isFreshStockCheck(new Date(now + 60_001).toISOString(), now), false);
	assert.equal(websiteMenuKey('Fish & Chips'), 'fish-and-chips');
});

test('proxy: missing settings, upstream errors, invalid data, success and server-only token', async (t) => {
	t.mock.method(console, 'error', () => {});
	const env = globalThis.__stockFixtureEnv;
	delete env.DASHBOARD_STOCK_API_URL;
	delete env.DASHBOARD_STOCK_API_TOKEN;
	let calls = 0;
	const fetchGood = async (_url, init) => {
		calls++;
		assert.equal(init.headers.Authorization, 'Bearer fixture-token');
		assert.equal(init.cache, 'no-store');
		assert.ok(init.signal instanceof AbortSignal);
		return response(good());
	};
	assert.equal((await GET({ fetch: fetchGood })).status, 503);
	env.DASHBOARD_STOCK_API_URL = 'https://fixture.invalid/menu-stock';
	assert.equal((await GET({ fetch: fetchGood })).status, 503);
	assert.equal(calls, 0);
	env.DASHBOARD_STOCK_API_TOKEN = 'fixture-token';
	const success = await GET({ fetch: fetchGood });
	assert.equal(success.status, 200);
	assert.equal(success.headers.get('cache-control'), 'public, max-age=0, s-maxage=15');
	assert.equal((await success.text()).includes('fixture-token'), false);
	for (const fetch of [
		async () => response({ ...good(), items: [null] }),
		async () => response({ ...good(), stockCheckedAt: null }),
		async () =>
			response({ ...good(), stockCheckedAt: new Date(Date.now() - 46 * 60_000).toISOString() }),
		async () => new Response('', { status: 401 }),
		async () => {
			throw new Error('Fixture failure');
		},
		async () => new Response('not json')
	]) {
		assert.equal((await GET({ fetch })).status, 503);
	}
});

test('proxy: 8-second deadline covers stalled headers and stalled bodies', async (t) => {
	t.mock.method(console, 'error', () => {});
	t.mock.timers.enable({ apis: ['setTimeout'] });
	Object.assign(globalThis.__stockFixtureEnv, {
		DASHBOARD_STOCK_API_URL: 'https://fixture.invalid/menu-stock',
		DASHBOARD_STOCK_API_TOKEN: 'fixture-token'
	});
	for (const bodyStall of [false, true]) {
		let signal;
		const result = GET({
			fetch: async (_url, init) => {
				signal = init.signal;
				return bodyStall ? { ok: true, json: () => new Promise(() => {}) } : new Promise(() => {});
			}
		});
		await flush();
		t.mock.timers.tick(UPSTREAM_STOCK_TIMEOUT_MS - 1);
		assert.equal(signal.aborted, false);
		t.mock.timers.tick(1);
		assert.equal((await result).status, 503);
		assert.equal(signal.aborted, true);
	}
});

test('client: five ordinary failures clear old labels; valid result resets count', async () => {
	let mode = 'good';
	const client = page(async () =>
		mode === 'good' ? response(good()) : new Response('', { status: 503 })
	);
	await flush();
	assert.equal(client.state().stockByKey.fixture, true);
	mode = 'bad';
	for (let n = 0; n < 4; n++) {
		client.poll();
		await flush();
	}
	assert.equal(client.state().stockByKey.fixture, true);
	mode = 'good';
	client.poll();
	await flush();
	assert.equal(client.state().failedStockRefreshes, 0);
	mode = 'bad';
	for (let n = 0; n < 5; n++) {
		client.poll();
		await flush();
	}
	assert.deepEqual(client.state().stockByKey, {});
	client.close();
});

test('client: five malformed row responses clear labels without resetting the count', async () => {
	let first = true;
	const client = page(async () => {
		const payload = first ? good() : { ...good(), items: [good().items[0], null] };
		first = false;
		return response(payload);
	});
	await flush();
	for (let n = 1; n <= 5; n++) {
		client.poll();
		await flush();
		assert.equal(client.state().failedStockRefreshes, n);
	}
	assert.deepEqual(client.state().stockByKey, {});
	client.close();
});

test('client: stalled headers and bodies time out, count as failures and clear old labels', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	for (const bodyStall of [false, true]) {
		let first = true;
		let signal;
		const client = page(async (_url, init) => {
			signal = init.signal;
			if (first) {
				first = false;
				return response(good());
			}
			return bodyStall ? { ok: true, json: () => new Promise(() => {}) } : new Promise(() => {});
		});
		await flush();
		for (let n = 1; n <= 5; n++) {
			client.poll();
			await flush();
			t.mock.timers.tick(CLIENT_STOCK_TIMEOUT_MS);
			await flush();
			assert.equal(signal.aborted, true);
			assert.equal(client.state().failedStockRefreshes, n);
		}
		assert.deepEqual(client.state().stockByKey, {});
		client.close();
	}
});

test('client: no overlap; timed-out response cannot replace a newer result', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	const requests = [];
	const client = page(() => {
		const request = deferred();
		requests.push(request);
		return request.promise;
	});
	client.poll();
	client.poll();
	assert.equal(requests.length, 1);
	t.mock.timers.tick(CLIENT_STOCK_TIMEOUT_MS);
	await flush();
	client.poll();
	assert.equal(requests.length, 2);
	requests[1].resolve(response(good(false)));
	await flush();
	assert.equal(client.state().stockByKey.fixture, false);
	requests[0].resolve(response(good(true)));
	await flush();
	assert.equal(client.state().stockByKey.fixture, false);
	assert.equal(client.state().failedStockRefreshes, 0);
	client.document.visibilityState = 'hidden';
	client.poll();
	assert.equal(requests.length, 2);
	client.close();
});

test('client: page cleanup aborts requests and prevents late state changes', async () => {
	const pending = deferred();
	let signal;
	const client = page((_url, init) => {
		signal = init.signal;
		return pending.promise;
	});
	client.close();
	assert.equal(signal.aborted, true);
	pending.resolve(response(good()));
	await flush();
	assert.deepEqual(client.state(), { stockByKey: {}, failedStockRefreshes: 0 });
});
