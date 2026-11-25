import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LEGAL_CONTACT, LEGAL_SECTIONS, linkParts } from '../src/lib/legal.ts';

test('one page has the privacy and data deletion sections that Meta links to', () => {
	assert.deepEqual(
		LEGAL_SECTIONS.map((section) => section.id),
		['privacy', 'other-policies', 'data-deletion']
	);
	const redirects = JSON.parse(
		readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
	).redirects;
	for (const id of ['privacy', 'data-deletion']) {
		assert.ok(
			redirects.some(
				(rule) => rule.source === `/legal/${id}` && rule.destination === `/legal#${id}`
			)
		);
	}
	assert.ok(
		redirects.some((rule) => rule.source === '/legal/terms' && rule.destination === '/legal'),
		'old terms links still land on the page'
	);
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

test('the public page links to the applicant and player pages, and keeps employee texts off it', () => {
	const all = JSON.stringify(LEGAL_SECTIONS);
	assert.ok(all.includes('https://apply.levelonegamepub.com/legal'));
	assert.ok(all.includes('https://players.levelonegamepub.com/legal'));
	assert.doesNotMatch(
		all,
		/signer code|Reply STOP|Dungeon Masters can see|Google Calendar|applicants’ names/
	);
	const google = LEGAL_SECTIONS.find((section) => section.id === 'privacy').body.join(' ');
	assert.match(google, /Limited Use requirements/);
});
