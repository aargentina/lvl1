// Local fixture only. Does not load Vite, SvelteKit, environment files, or server routes.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { compile } from 'svelte/compiler';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  absWorkingDir: root, entryPoints: ['tests/rendered-stock-client.mjs'], bundle: true,
  write: false, format: 'esm', platform: 'browser', conditions: ['svelte', 'browser'],
  tsconfigRaw: { compilerOptions: { target: 'ES2022' } },
  logLevel: 'warning', metafile: true,
  plugins: [{ name: 'local-stock-fixture', setup(builder) {
    builder.onResolve({ filter: /^\$app\/stores$/ }, () => ({ path: 'stores', namespace: 'fixture' }));
    builder.onResolve({ filter: /^\$lib\/slices$/ }, () => ({ path: 'slices', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
      contents: path === 'stores'
        ? `import { readable } from 'svelte/store'; export const page = readable({data:{title:'Local stock fixture'},url:new URL('http://127.0.0.1/')});`
        : `import MenuItems from './src/lib/slices/MenuItems/index.svelte'; export const components = {image_cards:MenuItems};`,
      resolveDir: root, loader: 'js',
    }));
    builder.onResolve({ filter: /^\$lib\// }, ({ path }) => ({ path: resolve(root, 'src/lib', path.slice(5)) + (path.endsWith('menuStock') ? '.ts' : '') }));
    builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
      contents: compile(await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected', dev: true }).js.code,
      loader: 'js', resolveDir: dirname(path),
    }));
  } }],
});
for (const path of ['src/routes/food/+page.svelte', 'src/lib/slices/MenuItems/index.svelte', 'src/lib/slices/MenuItems/MenuItems.svelte', 'src/lib/menuStock.ts']) {
  if (!Object.hasOwn(result.metafile.inputs, path)) throw new Error(`Actual source missing: ${path}`);
}
if (Object.keys(result.metafile.inputs).some(path => /\+.*server|prismicio\.ts/.test(path))) throw new Error('Server source must not be loaded');
console.log('Compiled actual food page, menu slice, card, and stock reader. No server routes.');
if (!process.argv.includes('--check')) {
  const port = Number(process.argv[2] ?? '43134');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Local stock fixture</title>
  <style>body{font:16px sans-serif;margin:30px}button{margin:8px;padding:10px}#results{white-space:pre-wrap}#app{border:2px solid #555;padding:20px}li{padding:15px}span.uppercase{background:#ffcaca;padding:8px}</style></head>
  <body><h1>Case 34: local rendered stock fixture</h1><p>No live services. Poll timers are manual. Reload to reset.</p>
  <button id="fail">One failed poll (503)</button><button id="recover">One valid poll</button><button id="sequence">Run five-failure and recovery proof</button>
  <p id="status" role="status">Starting</p><pre id="results"></pre><main id="app"></main><script type="module" src="/fixture.js"></script></body></html>`;
  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'");
    if (req.method !== 'GET' || !['/', '/fixture.js'].includes(req.url)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', req.url === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
    res.end(req.url === '/' ? html : result.outputFiles[0].contents);
  });
  server.listen(port, '127.0.0.1', () => console.log(`Local fixture: http://127.0.0.1:${port}/ (Ctrl+C stops it)`));
  for (const event of ['SIGINT', 'SIGTERM']) process.on(event, () => server.close(() => process.exit(0)));
}
