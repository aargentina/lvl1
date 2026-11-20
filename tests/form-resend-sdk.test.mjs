// The real SDK uses a fake fetch. A real provider call is not permitted in this test.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === '$env/static/private')
			return {
				url: 'data:text/javascript,export const RESEND_API_KEY="re_synthetic_no_send"',
				shortCircuit: true
			};
		if (specifier === '$lib/server/formEmail')
			return {
				url: new URL('../src/lib/server/formEmail.ts', import.meta.url).href,
				shortCircuit: true
			};
		if (specifier === '$lib/formOptions')
			return {
				url: new URL('../src/lib/formOptions.ts', import.meta.url).href,
				shortCircuit: true
			};
		return nextResolve(specifier, context);
	}
});
const { POST } = await import('../src/routes/api/send-email/+server.ts');

test('the installed SDK sends Reply-To and the retry header through the real route', async () => {
	const originalFetch = globalThis.fetch;
	const calls = [];
	globalThis.fetch = async (input, init) => {
		assert.equal(String(input), 'https://api.resend.com/emails');
		assert.equal(init.method, 'POST');
		calls.push({ headers: new Headers(init.headers), body: JSON.parse(init.body) });
		return Response.json({ id: 'synthetic-receipt' });
	};
	try {
		const url = new URL('https://levelonegamepub.com/api/send-email');
		const fields = {
			name: 'Synthetic Visitor',
			email: 'visitor@example.com',
			message: 'A synthetic form test.',
			companyWebsite: '',
			submissionId: '62f752e8-453d-47be-91bf-52f8464e9a6a'
		};
		for (let index = 0; index < 2; index++) {
			const form = new FormData();
			for (const [key, value] of Object.entries(fields)) form.set(key, value);
			const request = new Request(url, {
				method: 'POST',
				headers: { origin: url.origin },
				body: form
			});
			const response = await POST({ request, url });
			assert.equal(response.status, 200);
		}
		assert.equal(calls.length, 2);
		assert.equal(calls[0].body.reply_to, 'visitor@example.com');
		assert.deepEqual(calls[0].body.to, ['levelonereservations@gmail.com']);
		assert.equal(calls[0].body.from, 'send@levelonegamepub.com');
		assert.match(calls[0].headers.get('idempotency-key'), /^website-form\//);
		assert.equal(calls[0].headers.get('idempotency-key'), calls[1].headers.get('idempotency-key'));
	} finally {
		globalThis.fetch = originalFetch;
	}
});
