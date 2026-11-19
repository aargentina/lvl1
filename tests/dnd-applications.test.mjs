// Render the real public page with local CMS data. No service is called.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createHttpServer } from 'node:http';
import { test } from 'node:test';
import { createServer } from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { compile } from 'svelte/compiler';

const root = fileURLToPath(new URL('../', import.meta.url));
const storesId = '\0dnd-stores';
const environmentId = '\0dnd-environment';
const prismicId = '\0dnd-prismic';
const slicesId = '\0dnd-slices';

test('the D&D page opens each application on the dashboard and keeps its CMS content', async () => {
	const sources = new Map([
		[environmentId, 'export const dev = false;'],
		[
			storesId,
			"import { writable } from 'svelte/store'; export const page = writable({ data: { title: 'D&D at Level One' } });"
		],
		[slicesId, 'export const components = {};'],
		[
			prismicId,
			compile('<p data-testid="cms-content">Existing event and ticket links</p>', {
				generate: 'server',
				filename: 'DndSliceFixture.svelte'
			}).js.code.replace('export default function DndSliceFixture', 'export function SliceZone')
		]
	]);
	const hmrServer = createHttpServer();
	await new Promise((resolve) => hmrServer.listen(0, '127.0.0.1', resolve));
	let server;
	try {
		server = await createServer({
			root,
			configFile: false,
			cacheDir: path.join(root, 'node_modules/.vite-dnd-tests'),
			plugins: [
				{
					name: 'dnd-local-data',
					resolveId: (id) => (sources.has(id) ? id : null),
					load: (id) => sources.get(id) ?? null
				},
				svelte({ configFile: false, preprocess: vitePreprocess(), hot: false })
			],
			resolve: {
				alias: [
					{ find: '$app/stores', replacement: storesId },
					{ find: '$app/environment', replacement: environmentId },
					{ find: '@prismicio/svelte', replacement: prismicId },
					{ find: '$lib/slices', replacement: slicesId },
					{ find: '$lib', replacement: path.join(root, 'src/lib') }
				]
			},
			server: {
				host: '127.0.0.1',
				middlewareMode: true,
				hmr: { port: 0, server: hmrServer },
				watch: null
			},
			ssr: { noExternal: ['svelte'] },
			optimizeDeps: { noDiscovery: true, include: [] }
		});
		const { render } = await server.ssrLoadModule('svelte/server');
		const { dndApplicationHref } = await server.ssrLoadModule('/src/lib/dnd-applications.ts');
		for (const role of ['player', 'dm']) {
			const canonical = `https://level-one-dashboard.vercel.app/games/join/${role}`;
			assert.equal(dndApplicationHref(role, false, 'http://127.0.0.1:3107'), canonical);
			assert.equal(dndApplicationHref(role, true), canonical);
			assert.equal(
				dndApplicationHref(role, true, 'http://127.0.0.1:3107'),
				`http://127.0.0.1:3107/games/preview?view=join-${role}`
			);
			assert.equal(
				dndApplicationHref(role, true, 'http://localhost:3107'),
				`http://localhost:3107/games/preview?view=join-${role}`
			);
			for (const invalid of [
				'https://evil.example',
				'http://localhost.evil.example',
				'http://127.0.0.1.evil.example',
				'http://user@localhost:3107',
				'http://localhost:3107/private',
				'http://localhost:3107/?token=value',
				'http://localhost:3107/#value',
				'invalid'
			]) {
				assert.equal(dndApplicationHref(role, true, invalid), canonical);
			}
		}
		const { default: Page } = await server.ssrLoadModule(
			'/src/routes/[[preview=preview]]/[uid]/+page.svelte'
		);
		const renderPage = (uid) =>
			render(Page, { props: { data: { page: { uid, data: { slices: [] } } } } });
		const result = renderPage('dnd');
		const links = [...result.body.matchAll(/href="([^"]+)"/g)].map((match) => new URL(match[1]));
		assert.deepEqual(
			links.map((url) => url.href),
			[
				'https://level-one-dashboard.vercel.app/games/join/player',
				'https://level-one-dashboard.vercel.app/games/join/dm'
			]
		);
		assert.ok(links.every((url) => !url.search && !url.hash));
		assert.match(result.body, /Apply as a player/);
		assert.match(result.body, /Apply as a DM/);
		assert.match(result.body, /does not guarantee a place/);
		assert.match(result.body, /verify your address/);
		assert.match(result.body, /data-testid="cms-content"/);
		assert.doesNotMatch(result.body, /<form|<iframe|target="_blank"/);
		assert.doesNotMatch(result.body, /Website preview|127\.0\.0\.1|localhost/);
		assert.doesNotMatch(renderPage('contact').body, /games\/join/);
		assert.doesNotMatch(renderPage('dnd-short').body, /games\/join/);

		if (process.env.DND_LOCAL_PREVIEW === 'true') {
			const { readFile, mkdir, writeFile } = await import('node:fs/promises');
			const { default: postcss } = await import('postcss');
			const { default: tailwindcss } = await import('tailwindcss');
			const sourceCss = (await readFile(path.join(root, 'src/app.postcss'), 'utf8'))
				.replace(/^@import[^;]+;/gm, '')
				.replaceAll("'/fonts/", "'../static/fonts/")
				.replaceAll("'./lib/assets/images/Noise.png'", "'../src/lib/assets/images/Noise.png'");
			const css = await postcss([tailwindcss()]).process(sourceCss, {
				from: path.join(root, 'src/app.postcss')
			});
			await mkdir(path.join(root, 'outputs'), { recursive: true });
			await writeFile(
				path.join(root, 'outputs/dnd-applications-preview.html'),
				`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D&D applications — local preview</title><style>${css.css}</style></head><body data-theme="myCustonTheme"><main>${result.body}</main></body></html>`
			);
		}
	} finally {
		await server?.close();
		await new Promise((resolve) => hmrServer.close(resolve));
	}
});
