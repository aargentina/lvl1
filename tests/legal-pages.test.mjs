import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LEGAL_CONTACT, LEGAL_SECTIONS, linkParts } from '../src/lib/legal.ts';

test('one page has the privacy, terms and data deletion sections that Meta links to', () => {
	assert.deepEqual(
		LEGAL_SECTIONS.map((section) => section.id),
		['privacy', 'terms', 'data-deletion']
	);
	const redirects = JSON.parse(
		readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
	).redirects;
	for (const id of ['privacy', 'terms', 'data-deletion']) {
		assert.ok(
			redirects.some(
				(rule) => rule.source === `/legal/${id}` && rule.destination === `/legal#${id}`
			)
		);
	}
});

test('the page shows no staff dashboard address', () => {
	assert.doesNotMatch(JSON.stringify(LEGAL_SECTIONS), /vercel\.app|theloftlounge/i);
	assert.equal(LEGAL_CONTACT, 'info@levelonegamepub.com');
});

test('web and email addresses become links, without the end punctuation', () => {
	assert.deepEqual(
		linkParts('Email info@levelonegamepub.com. Notice: https://apply.levelonegamepub.com/privacy.'),
		[
			{ text: 'Email ' },
			{ text: 'info@levelonegamepub.com', href: 'mailto:info@levelonegamepub.com' },
			{ text: '. Notice: ' },
			{
				text: 'apply.levelonegamepub.com/privacy',
				href: 'https://apply.levelonegamepub.com/privacy'
			},
			{ text: '.' }
		]
	);
	assert.deepEqual(linkParts('Policy (https://example.com/a), here.'), [
		{ text: 'Policy (' },
		{ text: 'example.com/a', href: 'https://example.com/a' },
		{ text: '), here.' }
	]);
});
