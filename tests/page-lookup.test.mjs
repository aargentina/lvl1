import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundError } from '@prismicio/client';
import { getPageOr404 } from '../src/lib/pageLookup.ts';

test('returns the page when Prismic has it', async () => {
	const page = { uid: 'contact' };
	const client = { getByUID: async () => page };
	assert.equal(await getPageOr404(client, 'contact'), page);
});

test('a missing page is a 404, not a 500', async () => {
	const client = {
		getByUID: async () => {
			throw new NotFoundError('No documents were returned', 'https://example.invalid', undefined);
		}
	};
	await assert.rejects(getPageOr404(client, 'contact-us'), (err) => err?.status === 404);
});

test('other Prismic failures are not hidden as a 404', async () => {
	const failure = new Error('network down');
	const client = {
		getByUID: async () => {
			throw failure;
		}
	};
	await assert.rejects(getPageOr404(client, 'contact'), (err) => err === failure);
});
