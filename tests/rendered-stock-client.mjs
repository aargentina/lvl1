import { mount, tick } from 'svelte';
import Food from '../src/routes/food/+page.svelte';

// Only the timer and fetch boundary are controlled. Do not copy the stock algorithm.
let poll, mode = 'good', requests = 0, busy = false;
const setInterval = window.setInterval.bind(window), clearInterval = window.clearInterval.bind(window);
window.setInterval = (callback, delay, ...args) => {
  if (delay === 30_000) { poll = callback; return -34; }
  return setInterval(callback, delay, ...args);
};
window.clearInterval = id => { if (id !== -34) clearInterval(id); };
window.fetch = async (url, options) => {
  if (url !== '/api/menu-stock' || options?.cache !== 'no-store') throw new Error('Unexpected fixture request');
  requests++;
  if (mode === 'bad') return new Response('', { status: 503 });
  return Response.json({ ok: true, stockCheckedAt: new Date().toISOString(), items: [
    { key: 'fixture-soup', name: 'Fixture Soup', unavailable: true, source: 'toast' },
  ] });
};
const rich = text => [{ type: 'paragraph', text, spans: [] }];
const card = (name, removed = false) => ({ title: rich(name), price: rich('$1'), text: rich('Synthetic test item'), notes: [], image: {}, remove_items: removed });
mount(Food, { target: document.querySelector('#app'), props: { data: { page: { data: { slices: [{
  id: 'fixture-menu', slice_type: 'image_cards', variation: 'default', version: 'initial', items: [],
  primary: { heading: [], cards: [card('Fixture Soup'), card('Fixture Bread'), card('Editorially Removed', true)] },
}] } } } } });
const status = document.querySelector('#status'), results = document.querySelector('#results');
const buttons = [...document.querySelectorAll('button')];
async function settle() { await new Promise(resolve => setTimeout(resolve, 30)); await tick(); }
function label(name) {
  const row = [...document.querySelectorAll('#app li')].find(item => item.textContent.includes(name));
  if (!row) throw new Error(`Rendered card missing: ${name}`);
  return row.textContent.includes('Temporarily unavailable');
}
function verify(expected, step) {
  if (label('Fixture Soup') !== expected || label('Fixture Bread') || !label('Editorially Removed')) throw new Error(`FAIL: ${step}`);
  results.textContent += `PASS: ${step}\n`;
}
async function one(next) {
  if (!poll) throw new Error('Food page did not register its poll');
  mode = next; const before = requests; poll(); await settle();
  if (requests !== before + 1) throw new Error('Expected exactly one poll; keep this tab visible');
  status.textContent = `Responses: ${requests}. Soup label: ${label('Fixture Soup') ? 'shown' : 'clear'}.`;
}
async function action(run) {
  if (busy) return; busy = true; buttons.forEach(button => button.disabled = true);
  try { await run(); } catch (error) { status.textContent = String(error); results.textContent += `${error}\n`; }
  finally { busy = false; buttons.forEach(button => button.disabled = false); }
}
document.querySelector('#fail').onclick = () => action(() => one('bad'));
document.querySelector('#recover').onclick = () => action(() => one('good'));
document.querySelector('#sequence').onclick = () => action(async () => {
  results.textContent = ''; await one('good'); verify(true, 'valid response shows soup label');
  for (let n = 1; n <= 5; n++) { await one('bad'); verify(n < 5, `failure ${n}: soup label ${n < 5 ? 'retained' : 'cleared'}`); }
  await one('good'); verify(true, 'recovery restores soup label');
  await one('bad'); verify(true, 'first failure after recovery retains label (counter reset)');
  await one('good'); verify(true, 'final recovery; unrelated card labels unchanged');
  status.textContent = 'PASS: rendered five-failure and recovery proof';
});
await settle();
verify(true, 'initial mount renders the real stock label');
status.textContent = 'Ready. Actual Svelte food and menu components are mounted.';
