import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createServer } from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const root = fileURLToPath(new URL('../', import.meta.url));
const richText = (text) => [{ type: 'paragraph', text, spans: [] }];
const card = (title, extra = {}) => ({
	title: richText(title),
	image: {},
	price: [],
	text: [],
	notes: [],
	remove_items: false,
	...extra
});

test('trial page is isolated from the current food page', async () => {
	const currentFood = await readFile(path.join(root, 'src/routes/food/+page.svelte'), 'utf8');
	const currentDrink = await readFile(path.join(root, 'src/routes/drink/+page.svelte'), 'utf8');
	const trialFood = await readFile(path.join(root, 'src/routes/food-live/+page.svelte'), 'utf8');
	const trialDrink = await readFile(path.join(root, 'src/routes/drink-live/+page.svelte'), 'utf8');
	assert.doesNotMatch(currentFood, /menu-stock|FoodLiveMenu|Trial menu/);
	assert.doesNotMatch(currentDrink, /menu-stock|FoodLiveMenu|Trial menu/);
	assert.match(trialFood, /\/api\/menu-stock/);
	assert.match(trialDrink, /\/api\/menu-stock/);
	assert.match(trialFood, /noindex,nofollow/);
	assert.match(trialDrink, /noindex,nofollow/);
	assert.match(trialFood, /Trial menu/);
	assert.match(trialDrink, /Trial menu/);
});

test('trial menu renders live labels without changing card content', async (t) => {
	const server = await createServer({
		root,
		configFile: false,
		cacheDir: path.join(root, 'node_modules/.vite-food-live-tests'),
		plugins: [svelte({ configFile: false, preprocess: vitePreprocess(), hot: false })],
		resolve: { alias: { $lib: path.join(root, 'src/lib') } },
		server: { host: '127.0.0.1', middlewareMode: true, hmr: false, watch: null },
		ssr: { noExternal: ['@prismicio/svelte', 'svelte'] },
		optimizeDeps: { noDiscovery: true, include: [] }
	});
	try {
		const { render } = await server.ssrLoadModule('svelte/server');
		const { SliceZone } = await server.ssrLoadModule('@prismicio/svelte');
		const { default: FoodLiveMenuSection } = await server.ssrLoadModule(
			'/src/lib/slices/FoodLiveMenu/FoodLiveMenuSection.svelte'
		);
		const renderCards = (cards, stockByKey = {}) =>
			render(SliceZone, {
				props: {
					components: { image_cards: FoodLiveMenuSection },
					context: { stockByKey },
					slices: [
						{
							id: 'food',
							slice_type: 'image_cards',
							variation: 'default',
							primary: { heading: richText('Food menu'), cards }
						}
					]
				}
			}).body;

		await t.test('NEW and unavailable can show together', () => {
			const html = renderCards([card('House Salad')], {
				'house-salad': { unavailable: true, isNew: true }
			});
			assert.match(html, /House Salad/);
			assert.match(html, />NEW<\/span>/);
			assert.match(html, /Temporarily unavailable/);
		});

		await t.test('sample mode shows both label types without live data', () => {
			const html = render(SliceZone, {
				props: {
					components: { image_cards: FoodLiveMenuSection },
					context: { stockByKey: {}, stockPreview: true },
					slices: [
						{
							id: 'drink',
							slice_type: 'image_cards',
							variation: 'default',
							primary: {
								heading: richText('Draft beer'),
								cards: [card('First Drink'), card('Second Drink')]
							}
						}
					]
				}
			}).body;
			assert.equal((html.match(/>NEW<\/span>/g) || []).length, 2);
			assert.equal((html.match(/Temporarily unavailable/g) || []).length, 1);
		});

		await t.test('old and available items have no label', () => {
			const html = renderCards([card('House Salad')], {
				'house-salad': { unavailable: false, isNew: false }
			});
			assert.match(html, /House Salad/);
			assert.doesNotMatch(html, />NEW<\/span>|Temporarily unavailable/);
		});

		await t.test('empty Prismic placeholder cards stay hidden', () => {
			const html = renderCards([
				card('Currently Unavailable. Sorry!', { remove_items: true }),
				card('Nothing New at the Moment! Check Back Soon!', { remove_items: true }),
				card('House Salad')
			]);
			assert.doesNotMatch(html, /Currently Unavailable\. Sorry!/);
			assert.doesNotMatch(html, /Nothing New at the Moment!/);
			assert.match(html, /House Salad/);
		});

		await t.test('named Prismic 86 items stay visible with a label', () => {
			const html = renderCards([card('Drip Coffee', { remove_items: true })]);
			assert.match(html, /Drip Coffee/);
			assert.match(html, /Temporarily unavailable/);
		});
	} finally {
		await server.close();
	}
});
