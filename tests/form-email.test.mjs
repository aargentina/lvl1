// Synthetic form data only. The mail client is replaced before the route is imported.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
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
const {
	FORM_TEXT_LIMIT,
	MAX_FORM_BYTES,
	FormInputError,
	checkFormOrigin,
	handleFormEmail,
	prepareFormMail
} = await import('../src/lib/server/formEmail.ts');

const url = new URL('https://levelonegamepub.com/api/send-email');
const contact = () => ({
	name: 'Élodie 王',
	email: 'visitor@example.com',
	message: 'Please tell me about games.',
	companyWebsite: '',
	submissionId: randomUUID()
});
const group = () => ({
	organizerName: 'Élodie 王',
	phone: '+1 (613) 555-0100 ext 12',
	email: 'visitor@example.com',
	confirmEmail: 'visitor@example.com',
	organization: 'Synthetic Club',
	peopleCount: '25',
	date: '2026-12-12',
	time: '6:30 PM',
	gameType: 'both',
	paymentArrangements: 'one-bill',
	additionalRequirements: 'A quiet table, please.',
	companyWebsite: '',
	submissionId: randomUUID()
});
function data(fields) {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.append(key, value);
	return form;
}
function request(fields = contact(), headers = {}) {
	return new Request(url, {
		method: 'POST',
		body: fields instanceof FormData ? fields : data(fields),
		headers: { origin: url.origin, 'sec-fetch-site': 'same-origin', ...headers }
	});
}
const sends = [];
const send = async (mail, options) => {
	sends.push({ mail, options });
	return { data: { id: 'synthetic-mail' }, error: null };
};

test('contact and group requests send to the fixed mailbox with a validated reply address', async () => {
	for (const fields of [contact(), group()]) {
		const before = sends.length;
		const response = await handleFormEmail(request(fields), url, send);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { success: true });
		assert.equal(response.headers.get('cache-control'), 'no-store');
		assert.equal(sends.length, before + 1);
		assert.equal(sends.at(-1).mail.from, 'send@levelonegamepub.com');
		assert.deepEqual(sends.at(-1).mail.to, ['levelonereservations@gmail.com']);
		assert.equal(sends.at(-1).mail.replyTo, fields.email);
		assert.match(sends.at(-1).mail.html, /Élodie 王/);
	}
});

test('native form posts without a browser retry ID still send valid mail', async () => {
	for (const fields of [contact(), group()]) {
		delete fields.submissionId;
		const first = prepareFormMail(data(fields));
		const second = prepareFormMail(data(fields));
		assert.notEqual(first.idempotencyKey, second.idempotencyKey);
		const before = sends.length;
		const response = await handleFormEmail(request(fields), url, send);
		assert.equal(response.status, 200);
		assert.equal(sends.length, before + 1);
	}
});

test('every existing time, game and payment option is accepted', () => {
	for (const time of [
		'10:00 AM',
		'10:30 AM',
		'11:00 AM',
		'11:30 AM',
		'12:00 PM',
		'12:30 PM',
		'1:00 PM',
		'1:30 PM',
		'2:00 PM',
		'2:30 PM',
		'3:00 PM',
		'3:30 PM',
		'4:00 PM',
		'4:30 PM',
		'5:00 PM',
		'5:30 PM',
		'6:00 PM',
		'6:30 PM'
	])
		assert.ok(prepareFormMail(data({ ...group(), time })));
	for (const gameType of ['board-games', 'video-games', 'both'])
		assert.ok(prepareFormMail(data({ ...group(), gameType })));
	for (const paymentArrangements of ['individual', 'one-bill', 'other'])
		assert.ok(prepareFormMail(data({ ...group(), paymentArrangements })));
});

test('customer HTML is displayed as text in both mail shapes', () => {
	const injection = '<img src="x" onerror="alert(1)"> & \'quoted\'';
	for (const fields of [
		{ ...contact(), name: injection, message: injection },
		{
			...group(),
			organizerName: injection,
			organization: injection,
			additionalRequirements: injection
		}
	]) {
		const { mail } = prepareFormMail(data(fields));
		assert.ok(!mail.html.includes(injection));
		assert.ok(!mail.html.includes('<img'));
		assert.match(mail.html, /&lt;img src=&quot;x&quot;/);
		assert.match(mail.html, /&amp; &#39;quoted&#39;/);
	}
});

test('multiline messages stay valid, but header controls are rejected', () => {
	assert.ok(
		prepareFormMail(data({ ...contact(), message: 'First line\nSecond line\twith a tab.' }))
	);
	for (const [key, value] of [
		['email', 'a@example.com\r\nBcc: other@example.com'],
		['name', 'A\nB'],
		['organizerName', 'A\u2028B']
	])
		assert.throws(
			() =>
				prepareFormMail(data({ ...(key === 'organizerName' ? group() : contact()), [key]: value })),
			FormInputError
		);
});

test('missing, empty, oversized and invalid email fields cannot send mail', async () => {
	const invalid = [
		{ ...contact(), name: '' },
		{ ...contact(), message: ' ' },
		{ ...contact(), name: 'x'.repeat(121) },
		{ ...contact(), message: 'x'.repeat(FORM_TEXT_LIMIT + 1) },
		{ ...contact(), email: 'a@example' },
		{ ...contact(), email: 'A <a@example.com>' },
		{ ...contact(), email: 'a@example.com,b@example.com' },
		{ ...contact(), email: '.a@example.com' },
		{ ...contact(), email: 'a..b@example.com' },
		{ ...contact(), email: `${'a'.repeat(65)}@example.com` },
		{ ...contact(), message: 'x\u0000y' },
		{ ...contact(), submissionId: 'not-a-uuid' },
		{ ...group(), confirmEmail: 'other@example.com' }
	];
	const missing = contact();
	delete missing.email;
	invalid.push(missing);
	for (const fields of invalid) {
		let called = false;
		const response = await handleFormEmail(request(fields), url, async () => {
			called = true;
			return { error: null, data: { id: 'unexpected' } };
		});
		assert.equal(response.status, 400);
		assert.equal(called, false);
	}
});

test('group fields require real dates, positive whole counts, phone and listed choices', () => {
	for (const [key, value] of [
		['date', '2026-02-30'],
		['date', '2026-1-01'],
		['date', 'not-a-date'],
		['peopleCount', '0'],
		['peopleCount', '-1'],
		['peopleCount', '1.5'],
		['peopleCount', '1e2'],
		['peopleCount', '10000'],
		['phone', 'abc'],
		['time', '7:00 PM'],
		['gameType', 'hacked'],
		['paymentArrangements', 'free']
	])
		assert.throws(() => prepareFormMail(data({ ...group(), [key]: value })), FormInputError);
	assert.ok(prepareFormMail(data({ ...group(), date: '2028-02-29' })));
});

test('duplicate, unknown, file and mixed form fields are rejected', () => {
	const forms = [data(contact()), data(contact()), data(contact()), data(group())];
	forms[0].append('email', 'other@example.com');
	forms[1].append('to', 'other@example.com');
	forms[2].set('message', new File(['not text'], 'file.txt'));
	forms[3].append('message', 'mixed request');
	for (const form of forms) assert.throws(() => prepareFormMail(form), FormInputError);
});

test('a populated honeypot returns a quiet success without a mail request', async () => {
	let called = false;
	const response = await handleFormEmail(
		request({ ...contact(), companyWebsite: 'https://spam.example' }),
		url,
		async () => {
			called = true;
			return { error: null };
		}
	);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { success: true });
	assert.equal(called, false);
});

test('foreign, missing and cross-site origins are blocked before the body is read', async () => {
	for (const headers of [
		{ origin: 'https://evil.example' },
		{ origin: 'null' },
		{ origin: 'https://levelonegamepub.com.evil.example' },
		{ 'sec-fetch-site': 'cross-site' }
	]) {
		const response = await handleFormEmail(request(contact(), headers), url, send);
		assert.equal(response.status, 403);
	}
	const missing = request();
	missing.headers.delete('origin');
	assert.throws(() => checkFormOrigin(missing, url), FormInputError);
	const www = new URL('https://www.levelonegamepub.com/api/send-email');
	assert.doesNotThrow(() =>
		checkFormOrigin(new Request(www, { headers: { origin: www.origin } }), www)
	);
});

test('large declared bodies are rejected before reading', async () => {
	const oversized = new Request(url, {
		method: 'POST',
		headers: {
			origin: url.origin,
			'content-type': 'application/x-www-form-urlencoded',
			'content-length': String(MAX_FORM_BYTES + 1)
		},
		body: 'small'
	});
	const response = await handleFormEmail(oversized, url, send);
	assert.equal(response.status, 413);
	assert.equal(oversized.bodyUsed, false);
});

test('streamed bodies are bounded without trusting a missing or false length', async () => {
	for (const length of [undefined, '1']) {
		let cancelled = false;
		const chunks = [new Uint8Array(MAX_FORM_BYTES), new Uint8Array(1), new Uint8Array(1)];
		const stream = new ReadableStream({
			pull(controller) {
				controller.enqueue(chunks.shift());
			},
			cancel() {
				cancelled = true;
			}
		});
		const headers = { origin: url.origin, 'content-type': 'application/x-www-form-urlencoded' };
		if (length) headers['content-length'] = length;
		const response = await handleFormEmail(
			new Request(url, { method: 'POST', body: stream, duplex: 'half', headers }),
			url,
			send
		);
		assert.equal(response.status, 413);
		assert.equal(cancelled, true);
	}
});

test('malformed multipart and unsupported JSON bodies never reach mail', async () => {
	for (const [contentType, body, status] of [
		['multipart/form-data; boundary=nope', 'broken', 400],
		['application/json', '{}', 415]
	]) {
		const response = await handleFormEmail(
			new Request(url, {
				method: 'POST',
				headers: { origin: url.origin, 'content-type': contentType },
				body
			}),
			url,
			send
		);
		assert.equal(response.status, status);
	}
});

test('provider rejection, missing receipt and exceptions return a generic error', async () => {
	for (const fake of [
		async () => ({ error: { message: 'private provider details' } }),
		async () => ({ error: null, data: null }),
		async () => {
			throw new Error('private provider details');
		}
	]) {
		const response = await handleFormEmail(request(), url, fake);
		assert.equal(response.status, 502);
		const body = await response.json();
		assert.equal(body.success, false);
		assert.ok(!body.error.includes('private'));
	}
});

test('a repeated submission keeps the provider key; new text or a new submission changes it', () => {
	const fields = contact();
	const first = prepareFormMail(data(fields));
	assert.equal(first.idempotencyKey, prepareFormMail(data(fields)).idempotencyKey);
	assert.notEqual(
		first.idempotencyKey,
		prepareFormMail(data({ ...fields, message: 'Changed text' })).idempotencyKey
	);
	assert.notEqual(
		first.idempotencyKey,
		prepareFormMail(data({ ...fields, submissionId: randomUUID() })).idempotencyKey
	);
});

test('both client forms keep a retry ID, guard repeat submits and expose a labelled trap', () => {
	for (const file of ['src/lib/components/Form.svelte', 'src/lib/slices/LargeReso/index.svelte']) {
		const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
		assert.match(source, /if \(submitting\) return/);
		assert.match(source, /submissionId \|\|= crypto.randomUUID/);
		assert.match(source, /formData.set\('submissionId', submissionId\)/);
		assert.match(source, /Leave this field blank/);
		assert.match(source, /name="companyWebsite"/);
		assert.match(source, /response.status === 429/);
	}
});

globalThis.__formRouteSend = send;
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === '$env/static/private')
			return {
				url: 'data:text/javascript,export const RESEND_API_KEY="synthetic-no-send"',
				shortCircuit: true
			};
		if (specifier === '$lib/server/formEmail')
			return {
				url: new URL('../src/lib/server/formEmail.ts', import.meta.url).href,
				shortCircuit: true
			};
		if (specifier === 'resend')
			return {
				url: 'data:text/javascript,export class Resend { emails={send:(...args)=>globalThis.__formRouteSend(...args)} }',
				shortCircuit: true
			};
		return nextResolve(specifier, context);
	}
});
const { POST } = await import('../src/routes/api/send-email/+server.ts');
test('the actual route uses the checked mail path and provider idempotency option', async () => {
	const before = sends.length;
	const response = await POST({ request: request(), url });
	assert.equal(response.status, 200);
	assert.equal(sends.length, before + 1);
	assert.match(sends.at(-1).options.idempotencyKey, /^website-form\//);
});
