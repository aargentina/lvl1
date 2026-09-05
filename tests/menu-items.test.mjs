// Run with Node 24: npm run test:menu
import assert from 'node:assert/strict';
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
	remove_items: true,
	...extra
});

test('menu cards preserve content and hide only empty unavailable placeholders', async (t) => {
	const server = await createServer({
		root,
		configFile: false,
		cacheDir: path.join(root, 'node_modules/.vite-menu-tests'),
		plugins: [svelte({ configFile: false, preprocess: vitePreprocess(), hot: false })],
		resolve: { alias: { $lib: path.join(root, 'src/lib') } },
		server: { host: '127.0.0.1', middlewareMode: true, hmr: false, watch: null },
		ssr: { noExternal: ['@prismicio/svelte', 'svelte'] },
		optimizeDeps: { noDiscovery: true, include: [] }
	});
	try {
		const { render } = await server.ssrLoadModule('svelte/server');
		const { SliceZone } = await server.ssrLoadModule('@prismicio/svelte');
		const { default: MenuItems } = await server.ssrLoadModule(
			'/src/lib/slices/MenuItems/index.svelte'
		);
		const renderCards = (cards, stockByKey = {}) =>
			render(SliceZone, {
				props: {
					components: { image_cards: MenuItems },
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
		const placeholder = () => card('Currently Unavailable. Sorry!');

		await t.test('both empty placeholder cards are absent', () => {
			const html = renderCards([
				placeholder(),
				card('House Salad', { remove_items: false, price: richText('$12') }),
				placeholder()
			]);
			assert.doesNotMatch(html, /Currently Unavailable|Temporarily unavailable/);
			assert.match(html, /House Salad/);
			assert.match(html, /\$12/);
			assert.equal((html.match(/<li\b/g) || []).length, 1);
		});
		await t.test('named removed dishes remain visible without price or description', () => {
			const html = renderCards([card('Seasonal Soup')]);
			assert.match(html, /Seasonal Soup/);
			assert.match(html, /Temporarily unavailable/);
		});
		await t.test('description-only and notes-only add-ons remain visible', () => {
			const html = renderCards([
				card('', { text: richText('Ask about gluten-free options') }),
				card('', { notes: richText('Add cheese for two dollars') })
			]);
			assert.match(html, /Ask about gluten-free options/);
			assert.match(html, /Add cheese for two dollars/);
			assert.equal((html.match(/<li\b/g) || []).length, 2);
		});
		await t.test('the placeholder title alone does not hide an active card', () => {
			assert.match(
				renderCards([card('Currently Unavailable. Sorry!', { remove_items: false })]),
				/Currently Unavailable\. Sorry!/
			);
		});
		await t.test('placeholder titles with content remain visible', () => {
			for (const extra of [
				{ price: richText('$3') },
				{ text: richText('Available next week') },
				{ notes: richText('Ask your server') },
				{
					image: {
						url: 'https://example.invalid/menu.jpg',
						dimensions: { width: 10, height: 10 },
						alt: 'Menu item'
					}
				}
			]) {
				assert.match(
					renderCards([card('Currently Unavailable. Sorry!', extra)]),
					/Currently Unavailable\. Sorry!/
				);
			}
		});
		await t.test('live stock still marks a named dish unavailable', () => {
			const dish = card('House Salad', { remove_items: false });
			assert.match(renderCards([dish], { 'house-salad': true }), /Temporarily unavailable/);
			assert.doesNotMatch(renderCards([dish], { 'house-salad': false }), /Temporarily unavailable/);
		});
	} finally {
		await server.close();
	}
});
