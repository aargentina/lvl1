// Synthetic form data only. No mail client or real provider is used.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { EMAIL_MISMATCH_MESSAGE, GROUP_TIME_OPTIONS } from '../src/lib/formOptions.ts';
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
const { FORM_TEXT_LIMIT, MAX_FORM_BYTES, handleFormEmail, prepareFormMail } = await import(
	'../src/lib/server/formEmail.ts'
);

const url = new URL('https://levelonegamepub.com/api/send-email');
const contact = () => ({
	name: 'Synthetic Visitor',
	email: 'visitor@example.com',
	message: 'A synthetic message.',
	companyWebsite: '',
	submissionId: randomUUID()
});
const group = () => ({
	organizerName: 'Synthetic Visitor',
	phone: '+1 613 555 0100',
	email: 'visitor@example.com',
	confirmEmail: 'visitor@example.com',
	organization: '',
	peopleCount: '25',
	date: '2026-12-12',
	time: '6:30 PM',
	gameType: 'both',
	paymentArrangements: 'one-bill',
	additionalRequirements: '',
	companyWebsite: '',
	submissionId: randomUUID()
});
function data(fields) {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return form;
}
const request = (fields) =>
	new Request(url, {
		method: 'POST',
		headers: { origin: url.origin },
		body: fields instanceof FormData ? fields : data(fields)
	});
const send = async () => ({ data: { id: 'synthetic-mail' }, error: null });

test('native URL-encoded forms accept the full non-ASCII textarea limit', async () => {
	const message = '漢'.repeat(FORM_TEXT_LIMIT);
	for (const fields of [
		{ ...contact(), message },
		{ ...group(), additionalRequirements: message }
	]) {
		delete fields.submissionId;
		const body = new URLSearchParams(fields);
		const size = Buffer.byteLength(body.toString());
		assert.ok(size > 32_768 && size <= MAX_FORM_BYTES);
		let accepted;
		const response = await handleFormEmail(
			new Request(url, { method: 'POST', headers: { origin: url.origin }, body }),
			url,
			async (mail) => {
				accepted = mail;
				return send();
			}
		);
		assert.equal(response.status, 200);
		assert.ok(accepted.html.includes(message));
	}
});

test('shared choices keep all 18 times valid for group mail', () => {
	assert.equal(GROUP_TIME_OPTIONS.length, 18);
	for (const time of GROUP_TIME_OPTIONS) assert.ok(prepareFormMail(data({ ...group(), time })));
});

test('mismatch and count errors use the exact customer wording', () => {
	assert.throws(() => prepareFormMail(data({ ...group(), confirmEmail: 'other@example.com' })), {
		message: EMAIL_MISMATCH_MESSAGE
	});
	assert.throws(() => prepareFormMail(data({ ...group(), peopleCount: '10000' })), {
		message: 'Enter a whole number of people from 1 to 9999.'
	});
	assert.throws(() => prepareFormMail(data({ ...contact(), submissionId: '' })));
});

test('all nonempty trap text is dropped after structural checks', async () => {
	let called = false;
	const fake = async () => {
		called = true;
		return send();
	};
	for (const companyWebsite of [' ', '\u0000', 'x'.repeat(5000), '漢'.repeat(10000)]) {
		const response = await handleFormEmail(request({ ...contact(), companyWebsite }), url, fake);
		assert.equal(response.status, 200);
	}
	const invalidForms = [data(contact()), data(contact()), data(contact())];
	for (const form of invalidForms) form.set('companyWebsite', 'filled');
	invalidForms[0].append('email', 'other@example.com');
	invalidForms[1].append('unknown', 'extra');
	invalidForms[2].set('message', new File(['file'], 'file.txt'));
	for (const form of invalidForms)
		assert.equal((await handleFormEmail(request(form), url, fake)).status, 400);
	assert.equal(called, false);
});

test('diagnostics use fixed categories and contain no private fixture text', async () => {
	const logs = [];
	const originalWarn = console.warn;
	const originalInfo = console.info;
	console.warn = (...parts) => logs.push(parts);
	console.info = (...parts) => logs.push(parts);
	const privateText = [
		'Private Fixture Name',
		'private-fixture@example.com',
		'Private fixture message',
		're_private_fixture_secret'
	];
	const fields = {
		...contact(),
		name: privateText[0],
		email: privateText[1],
		message: privateText[2]
	};
	const failText = privateText.join(' ');
	const expectOne = async (incoming, fake, expected) => {
		logs.length = 0;
		await handleFormEmail(incoming, url, fake);
		assert.deepEqual(logs, [['website_form', expected]]);
		const text = JSON.stringify(logs);
		const retryKey = prepareFormMail(data(fields)).idempotencyKey;
		for (const value of [...privateText, fields.submissionId, retryKey, retryKey.split('/').at(-1)])
			assert.ok(!text.includes(value));
	};
	try {
		await expectOne(
			request(fields),
			async () => ({
				error: {
					name: 'rate_limit_exceeded',
					statusCode: 429,
					message: failText,
					response: { secret: failText }
				}
			}),
			{ event: 'provider_failed', code: 'rate_limit_exceeded', status: 429 }
		);
		await expectOne(
			request(fields),
			async () => ({ error: { name: failText, statusCode: failText, message: failText } }),
			{ event: 'provider_failed', code: 'unknown' }
		);
		await expectOne(
			request(fields),
			async () => ({ error: { name: 'validation_error', statusCode: 200, message: failText } }),
			{ event: 'provider_failed', code: 'validation_error' }
		);
		await expectOne(
			request(fields),
			async () => {
				throw new Error(failText, { cause: { secret: failText } });
			},
			{ event: 'transport_failed', code: 'transport_error' }
		);
		await expectOne(request(fields), async () => ({ error: null, data: null }), {
			event: 'provider_failed',
			code: 'unknown'
		});
		const invalid = data(fields);
		invalid.append(failText, failText);
		await expectOne(request(invalid), send, {
			event: 'input_rejected',
			category: 'fields',
			status: 400
		});
		await expectOne(request({ ...fields, companyWebsite: failText }), send, {
			event: 'honeypot_dropped'
		});
	} finally {
		console.warn = originalWarn;
		console.info = originalInfo;
	}
});
