import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSitemapPage, redirectedPageUids } from '../src/lib/sitemap.ts';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('/qr redirects permanently to /qrmenu', () => {
	const rule = vercel.redirects.find((r) => r.source === '/qr');
	assert.ok(rule, 'vercel.json has a /qr redirect');
	assert.equal(rule.destination, '/qrmenu');
	assert.equal(rule.permanent, true);
});

test('every page left out of the sitemap has a permanent redirect', () => {
	for (const uid of redirectedPageUids) {
		const rule = vercel.redirects.find((r) => r.source === `/${uid}`);
		assert.ok(rule?.permanent, `/${uid} has a permanent redirect`);
	}
});

test('sitemap keeps normal pages and drops redirected copies', () => {
	assert.equal(isSitemapPage('qr'), false);
	assert.equal(isSitemapPage('qrmenu'), true);
	assert.equal(isSitemapPage('home'), true);
	assert.equal(isSitemapPage(''), false);
	assert.equal(isSitemapPage(null), false);
});

test('old addresses from Search Console redirect to current pages', () => {
	const expected = { '/menus': '/select', '/contact-us': '/contact', '/how-it-': '/hiw' };
	for (const [source, destination] of Object.entries(expected)) {
		const rule = vercel.redirects.find((r) => r.source === source);
		assert.equal(rule?.destination, destination, `${source} redirects to ${destination}`);
		assert.equal(rule?.permanent, true);
	}
});
