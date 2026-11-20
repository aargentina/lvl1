// Run with Node 24: node --experimental-strip-types --test tests/marketing-signup.test.mjs
// No network: every request goes to a test function. Synthetic form data only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === '$lib/formOptions')
			return {
				url: new URL('../src/lib/formOptions.ts', import.meta.url).href,
				shortCircuit: true
			};
		return nextResolve(specifier, context);
	}
});
const { handleFormEmail, prepareFormMail } = await import('../src/lib/server/formEmail.ts');
const { saveEmailOffers } = await import('../src/lib/server/marketingSignup.ts');

const env = {
	MARKETING_SIGNUP_URL: 'https://dashboard.example.test/api/marketing-signups',
	MARKETING_SIGNUP_WEBSITE_KEY: 'k'.repeat(40)
};
const url = new URL('https://levelonegamepub.com/api/send-email');
const contact = (extra = {}) => ({
	name: 'Pat Guest',
	email: 'pat@example.com',
	message: 'Hello.',
	hp_7c2: '',
	submissionId: randomUUID(),
	...extra
});
const group = (extra = {}) => ({
	organizerName: 'Org Person',
	phone: '613 555 0100',
	email: 'org@example.com',
	confirmEmail: 'org@example.com',
	organization: '',
	peopleCount: '20',
	date: '2099-01-09',
	time: '6:00 PM',
	gameType: 'both',
	paymentArrangements: 'one-bill',
	additionalRequirements: '',
	hp_7c2: '',
	submissionId: randomUUID(),
	...extra
});
const formOf = (fields) => {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return form;
};
const request = (fields) =>
	new Request(url, {
		method: 'POST',
		headers: { origin: url.origin, 'sec-fetch-site': 'same-origin' },
		body: formOf(fields)
	});

test('only a selected box is a Yes, and any other value is rejected', () => {
	assert.equal(prepareFormMail(formOf(contact())).offers, null);
	assert.deepEqual(prepareFormMail(formOf(contact({ emailOffers: 'on' }))).offers, {
		form: 'contact',
		email: 'pat@example.com',
		name: 'Pat Guest'
	});
	assert.deepEqual(prepareFormMail(formOf(group({ emailOffers: 'on' }))).offers, {
		form: 'large_reso',
		email: 'org@example.com',
		name: 'Org Person'
	});
	for (const value of ['true', 'yes', 'off', ''])
		assert.throws(() => prepareFormMail(formOf(contact({ emailOffers: value }))), /invalid field/);
});

test('the staff email is the same with or without a Yes', () => {
	const id = randomUUID();
	const plain = prepareFormMail(formOf(contact({ submissionId: id })));
	const offered = prepareFormMail(formOf(contact({ submissionId: id, emailOffers: 'on' })));
	assert.deepEqual(offered.mail, plain.mail);
	assert.equal(offered.idempotencyKey, plain.idempotencyKey);
	assert.doesNotMatch(offered.mail.html, /news and offers/i);
});

test('the route saves a Yes before the email, skips a No and the spam trap, and a failed save still sends', async () => {
	const sent = [];
	const saved = [];
	const send = async (mail) => {
		sent.push(mail);
		return { error: null, data: { id: 'mail-1' } };
	};
	const save = async (offers) => {
		saved.push(offers);
	};
	assert.equal(
		(await handleFormEmail(request(contact({ emailOffers: 'on' })), url, send, save)).status,
		200
	);
	assert.equal((await handleFormEmail(request(contact()), url, send, save)).status, 200);
	assert.equal(
		(await handleFormEmail(request(contact({ emailOffers: 'on', hp_7c2: 'bot' })), url, send, save))
			.status,
		200
	);
	assert.deepEqual(saved, [{ form: 'contact', email: 'pat@example.com', name: 'Pat Guest' }]);
	assert.equal(sent.length, 2);
	const failing = await handleFormEmail(
		request(group({ emailOffers: 'on' })),
		url,
		send,
		async () => {
			throw new Error('down');
		}
	);
	assert.equal(failing.status, 200);
	assert.equal(sent.length, 3);
});

test('a Yes is sent to the dashboard with the website key, and failures are reported', async () => {
	const calls = [];
	const ok = async (target, init) => {
		calls.push({ target, init });
		return new Response('{"ok":true}', { status: 200 });
	};
	assert.equal(await saveEmailOffers('contact', ' pat@example.test ', ' Pat ', env, ok), 'saved');
	assert.equal(calls[0].target, env.MARKETING_SIGNUP_URL);
	assert.equal(calls[0].init.headers.Authorization, `Bearer ${env.MARKETING_SIGNUP_WEBSITE_KEY}`);
	assert.deepEqual(JSON.parse(calls[0].init.body), {
		form: 'contact',
		email: 'pat@example.test',
		name: 'Pat'
	});
	assert.equal(calls[0].init.redirect, 'error');
	assert.equal(
		await saveEmailOffers(
			'large_reso',
			'a@example.test',
			'A',
			env,
			async () => new Response('', { status: 503 })
		),
		'not_saved'
	);
	assert.equal(
		await saveEmailOffers('large_reso', 'a@example.test', 'A', env, async () => {
			throw new Error('down');
		}),
		'not_saved'
	);
	let count = 0;
	for (const bad of [
		{},
		{ ...env, MARKETING_SIGNUP_WEBSITE_KEY: 'short' },
		{ ...env, MARKETING_SIGNUP_URL: 'http://dashboard.example.test/api/marketing-signups' }
	])
		assert.equal(
			await saveEmailOffers('contact', 'a@example.test', '', bad, async () => {
				count++;
				return new Response('', { status: 200 });
			}),
			'not_saved'
		);
	assert.equal(count, 0);
});

test('both forms have the optional, unselected box under the email field', async () => {
	for (const file of ['src/lib/components/Form.svelte', 'src/lib/slices/LargeReso/index.svelte']) {
		const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
		const box = source.indexOf('name="emailOffers"');
		assert.ok(box > source.indexOf('name="email"'), file);
		// Strip tags and whitespace so a Prettier reflow can't break this.
		const text = source
			.slice(box, box + 600)
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ');
		assert.match(text, /Email me with news and offers\. You can unsubscribe at any time/, file);
		assert.doesNotMatch(source.slice(box, box + 160), /checked|required/);
	}
});
