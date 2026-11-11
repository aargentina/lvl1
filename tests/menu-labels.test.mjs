import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createServer } from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const root = fileURLToPath(new URL('../', import.meta.url));

const createTestServer = (appEnvironmentStub, cacheKey) =>
	createServer({
		root,
		configFile: false,
		cacheDir: path.join(root, `node_modules/.vite-${cacheKey}`),
		plugins: [svelte({ configFile: false, preprocess: vitePreprocess(), hot: false })],
		resolve: {
			alias: {
				$lib: path.join(root, 'src/lib'),
				'$app/environment': path.join(root, appEnvironmentStub),
				'$app/stores': path.join(root, 'tests/stubs/app-stores.js')
			}
		},
		server: { host: '127.0.0.1', middlewareMode: true, hmr: false, watch: null },
		ssr: { noExternal: ['@prismicio/svelte', 'svelte'] },
		optimizeDeps: { noDiscovery: true, include: [] }
	});

const richText = (text) => [{ type: 'paragraph', text, spans: [] }];
const card = (title, extra = {}) => ({
	website_menu_id: 'wm-0007',
	title: richText(title),
	image: {},
	price: [],
	text: [],
	notes: [],
	remove_items: false,
	...extra
});

test('menu cards label instead of hiding', async (t) => {
	// The store only polls in the browser; SSR just needs empty stock.
	const server = await createTestServer('tests/stubs/app-environment.js', 'menu-label-tests');
	try {
		const { render } = await server.ssrLoadModule('svelte/server');
		const { default: MenuSection } = await server.ssrLoadModule(
			'/src/lib/slices/MenuItems/index.svelte'
		);
		const { menuStock } = await server.ssrLoadModule('/src/lib/menuStock.svelte.ts');
		const { setTestPage } = await server.ssrLoadModule('/tests/stubs/app-stores.js');
		const setPage = (pathname, { search = '', data = {} } = {}) =>
			setTestPage({ url: new URL(`http://localhost${pathname}${search}`), data });

		const renderCards = (cards, byKey = {}, route = '/food', pageOptions) => {
			setPage(route, pageOptions);
			menuStock.byKey = byKey;
			return render(MenuSection, {
				props: {
					slice: {
						id: 'food',
						slice_type: 'image_cards',
						variation: 'default',
						primary: { heading: richText('Food menu'), cards }
					}
				}
			}).body;
		};

		await t.test('the retired New badge stays hidden while stock labels still work', () => {
			const html = renderCards([card('House Salad')], {
				'wm-0007': { unavailable: true, isNew: true }
			});
			assert.match(html, /House Salad/);
			assert.doesNotMatch(html, />New</);
			assert.match(html, /Temporarily unavailable/);
			const available = renderCards([card('House Salad')], {
				'wm-0007': { unavailable: false, isNew: true }
			});
			assert.doesNotMatch(available, />New<|Temporarily unavailable/);
		});

		await t.test('available items have no label', () => {
			const html = renderCards([card('House Salad')], {
				'wm-0007': { unavailable: false, isNew: false }
			});
			assert.match(html, /House Salad/);
			assert.doesNotMatch(html, />New<|Temporarily unavailable/);
		});

		// Matches the real shape in Prismic: 86'd menu items carry price/text,
		// the "Currently Unavailable. Sorry!" placeholders carry nothing.
		await t.test('a named Prismic 86 item stays visible with a label', () => {
			const html = renderCards([
				card('Midnight Stout', { remove_items: true, price: richText('$9') })
			]);
			assert.match(html, /Midnight Stout/);
			assert.match(html, /Temporarily unavailable/);
		});

		// ponytail: known ceiling. A title-only 86'd card is indistinguishable
		// from a placeholder, so it is hidden. Give it a price to keep it visible.
		await t.test('a title-only 86 card is treated as a placeholder', () => {
			assert.doesNotMatch(renderCards([card('Bare Item', { remove_items: true })]), /Bare Item/);
		});

		await t.test('empty 86 placeholder cards stay hidden whatever they are titled', () => {
			const html = renderCards([
				card('Currently Unavailable. Sorry!', { remove_items: true }),
				card('Some Other Placeholder Wording', { remove_items: true }),
				card('House Salad')
			]);
			assert.doesNotMatch(html, /Currently Unavailable\. Sorry!/);
			assert.doesNotMatch(html, /Some Other Placeholder Wording/);
			assert.match(html, /House Salad/);
		});

		await t.test('an 86 item keeps its card when it has real content', () => {
			const html = renderCards([
				card('Fish & Chips', { remove_items: true, price: richText('$18') })
			]);
			assert.match(html, /Fish &amp; Chips/);
			assert.match(html, /\$18/);
			assert.match(html, /Temporarily unavailable/);
		});

		// The store survives a client-side nav, so /wizard must ignore what's in it.
		await t.test('labels never render outside the menu pages', () => {
			const byKey = { 'wm-0007': { unavailable: true, isNew: true } };
			assert.match(renderCards([card('House Salad')], byKey, '/drink'), /Temporarily unavailable/);
			const wizard = renderCards([card('House Salad')], byKey, '/wizard');
			assert.match(wizard, /House Salad/);
			assert.doesNotMatch(wizard, />New<|Temporarily unavailable/);
		});

		// The title is editable, so it is never a stock key: a feed entry keyed
		// by the old title rule must not label the card.
		await t.test('only the Website Menu ID matches', () => {
			const html = renderCards([card('House Salad', { website_menu_id: 'wm-0007' })], {
				'wm-0007': { unavailable: true },
				'house-salad': { unavailable: false }
			});
			assert.match(html, /Temporarily unavailable/);
		});

		// Until the backfill runs, a card with no ID is simply unlabelled. The
		// dashboard alerts on the blank ID; the menu page still renders.
		await t.test('cards without an ID are never labelled', () => {
			for (const id of [null, undefined, '', '   ']) {
				const html = renderCards([card('House Salad', { website_menu_id: id })], {
					'house-salad': { unavailable: true, isNew: true },
					'': { unavailable: true, isNew: true }
				});
				assert.match(html, /House Salad/);
				assert.doesNotMatch(html, />New<|Temporarily unavailable/);
			}
		});

		await t.test('renaming a card with an ID does not break its label', () => {
			const byKey = { 'wm-0007': { unavailable: true } };
			const before = renderCards(
				[card('House Salad', { website_menu_id: 'wm-0007', price: richText('$9') })],
				byKey
			);
			const after = renderCards(
				[card('Garden Salad', { website_menu_id: 'wm-0007', price: richText('$11') })],
				byKey
			);
			assert.match(before, /Temporarily unavailable/);
			assert.match(after, /Garden Salad/);
			assert.match(after, /Temporarily unavailable/);
		});

		// Two cards sharing an ID is a content error the dashboard alerts on. The
		// page must stay predictable rather than pick one at random.
		await t.test('cards sharing an ID share its label', () => {
			const html = renderCards(
				[
					card('House Salad', { website_menu_id: 'wm-0007' }),
					card('Garden Salad', { website_menu_id: 'wm-0007' })
				],
				{ 'wm-0007': { unavailable: true } }
			);
			assert.equal(html.match(/Temporarily unavailable/g).length, 2);
		});
	} finally {
		await server.close();
	}
});

// A separate server so the poller sees browser: true without the render tests
// above starting a real poll.
test('in the browser', async (t) => {
	t.mock.method(console, 'error', () => {});
	const server = await createTestServer(
		'tests/stubs/app-environment-browser.js',
		'menu-poll-tests'
	);

	const realFetch = globalThis.fetch;
	let tick = () => {};
	globalThis.window = {
		location: { pathname: '/food', search: '', hostname: 'localhost' },
		setInterval: (callback) => {
			tick = callback;
			return 0;
		}
	};
	globalThis.document = { visibilityState: 'visible' };

	const feed = (items) => ({
		ok: true,
		stockCheckedAt: new Date().toISOString(),
		items
	});
	let respond = async () =>
		Response.json(
			feed([{ key: 'house-salad', name: 'House Salad', unavailable: true, source: 'toast' }])
		);
	globalThis.fetch = (...args) => respond(...args);
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	try {
		const { menuStock, startMenuStockPolling } = await server.ssrLoadModule(
			'/src/lib/menuStock.svelte.ts'
		);

		await t.test('the last confirmed labels survive a failing feed', async () => {
			startMenuStockPolling();
			await settle();
			assert.equal(menuStock.byKey['house-salad'].unavailable, true);

			// Ten failures in a row, well past the old five-failure give-up.
			respond = async () => {
				throw new Error('fixture outage');
			};
			for (let attempt = 0; attempt < 10; attempt += 1) {
				tick();
				await settle();
			}
			assert.equal(menuStock.byKey['house-salad'].unavailable, true);
		});

		// Sample labels are client-side only, so they can't be checked by the
		// prerender-shaped tests above.
		await t.test('sample labels need the server to allow them', async () => {
			const { render } = await server.ssrLoadModule('svelte/server');
			const { default: MenuSection } = await server.ssrLoadModule(
				'/src/lib/slices/MenuItems/index.svelte'
			);
			const { setTestPage } = await server.ssrLoadModule('/tests/stubs/app-stores.js');

			const withFlag = (stockPreviewAllowed) => {
				// Clear what the poller subtest left behind: this asserts on sample
				// labels only.
				menuStock.byKey = {};
				setTestPage({
					url: new URL('http://localhost/food?stock-preview=1'),
					data: { stockPreviewAllowed }
				});
				return render(MenuSection, {
					props: {
						slice: {
							id: 'food',
							slice_type: 'image_cards',
							variation: 'default',
							primary: {
								heading: richText('Food menu'),
								cards: [card('House Salad')]
							}
						}
					}
				}).body;
			};

			assert.match(withFlag(true), /Temporarily unavailable/);
			assert.doesNotMatch(withFlag(false), /Temporarily unavailable/);
		});
	} finally {
		globalThis.fetch = realFetch;
		delete globalThis.window;
		delete globalThis.document;
		await server.close();
	}
});
