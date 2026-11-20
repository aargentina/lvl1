import { createHash, randomUUID } from 'node:crypto';
import { EMAIL_MISMATCH_MESSAGE, GROUP_TIME_OPTIONS } from '$lib/formOptions';

export const MAX_FORM_BYTES = 131_072;
export const FORM_TEXT_LIMIT = 5_000;
function hasControl(value: string, multiline: boolean) {
	return Array.from(value).some((character) => {
		const code = character.codePointAt(0)!;
		if (code === 127) return true;
		if (multiline && [9, 10, 13].includes(code)) return false;
		return code < 32 || (!multiline && [0x2028, 0x2029].includes(code));
	});
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timeOptions = new Set<string>(GROUP_TIME_OPTIONS);

export class FormInputError extends Error {
	status: number;
	constructor(message: string, status = 400) {
		super(message);
		this.status = status;
	}
}

export type FormMail = {
	from: string;
	to: string[];
	replyTo: string;
	subject: string;
	html: string;
};

export function checkFormOrigin(request: Request, url: URL) {
	if (
		request.headers.get('origin') !== url.origin ||
		(request.headers.has('sec-fetch-site') &&
			request.headers.get('sec-fetch-site') !== 'same-origin')
	) {
		throw new FormInputError('Open the form on our website and try again.', 403);
	}
}

export async function readForm(request: Request): Promise<FormData> {
	const contentType = request.headers.get('content-type') || '';
	if (!/^(multipart\/form-data|application\/x-www-form-urlencoded)(?:;|$)/i.test(contentType))
		throw new FormInputError('Send the form from our website.', 415);
	const length = request.headers.get('content-length');
	if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_FORM_BYTES))
		throw new FormInputError('Your message is too long. Please shorten it.', 413);
	if (!request.body) throw new FormInputError('Complete the form and try again.');
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > MAX_FORM_BYTES) {
				await reader.cancel();
				throw new FormInputError('Your message is too long. Please shorten it.', 413);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return await new Response(bytes, { headers: { 'content-type': contentType } }).formData();
	} catch {
		throw new FormInputError('The form could not be read. Please try again.');
	}
}

function field(
	form: FormData,
	key: string,
	label: string,
	max: number,
	optional = false,
	multiline = false
) {
	const values = form.getAll(key);
	if (optional && values.length === 0) return '';
	if (values.length !== 1 || typeof values[0] !== 'string')
		throw new FormInputError(`Check the ${label} field.`);
	const raw = values[0];
	if (raw.length > max || hasControl(raw, multiline))
		throw new FormInputError(
			`Check the ${label} field. It contains too much text or an invalid character.`
		);
	const value = raw.trim();
	if (!optional && !value) throw new FormInputError(`Complete the ${label} field.`);
	return value;
}

export function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(character) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
	);
}

export function prepareFormMail(form: FormData): { mail: FormMail; idempotencyKey: string } | null {
	const isReservation = form.has('organizerName');
	const allowed = new Set([
		'email',
		'companyWebsite',
		'submissionId',
		...(isReservation
			? [
					'organizerName',
					'phone',
					'confirmEmail',
					'organization',
					'peopleCount',
					'date',
					'time',
					'gameType',
					'paymentArrangements',
					'additionalRequirements'
				]
			: ['name', 'message'])
	]);
	for (const [key, value] of form) {
		if (!allowed.has(key) || typeof value !== 'string' || form.getAll(key).length !== 1)
			throw new FormInputError(
				'The form contains an invalid field. Please reload it and try again.'
			);
	}
	const honeypot = form.get('companyWebsite');
	if (typeof honeypot === 'string' && honeypot.length > 0) return null;
	const submissionId = form.has('submissionId')
		? field(form, 'submissionId', 'submission', 36)
		: randomUUID();
	if (!uuid.test(submissionId)) throw new FormInputError('Please reload the form and try again.');
	const email = field(form, 'email', 'email address', 254);
	if (
		!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(
			email
		) ||
		email.split('@')[0].length > 64 ||
		email.startsWith('.') ||
		email.split('@')[0].endsWith('.') ||
		email.split('@')[0].includes('..') ||
		email
			.split('@')[1]
			.split('.')
			.some((part) => part.length > 63)
	)
		throw new FormInputError('Enter a valid email address.');
	let subject: string;
	let html: string;
	if (isReservation) {
		const organizerName = field(form, 'organizerName', 'organizer name', 120);
		const phone = field(form, 'phone', 'phone number', 50);
		if (!/^[+\d().\s#xext-]{7,50}$/i.test(phone) || phone.replace(/\D/g, '').length < 7)
			throw new FormInputError('Enter a valid phone number.');
		if (field(form, 'confirmEmail', 'confirm email address', 254) !== email)
			throw new FormInputError(EMAIL_MISMATCH_MESSAGE);
		const organization = field(form, 'organization', 'organization', 200, true);
		const peopleCount = field(form, 'peopleCount', 'number of people', 20);
		if (!/^[1-9]\d{0,3}$/.test(peopleCount))
			throw new FormInputError('Enter a whole number of people from 1 to 9999.');
		const date = field(form, 'date', 'preferred date', 10);
		const dateValue = new Date(`${date}T00:00:00Z`);
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
			!Number.isFinite(dateValue.valueOf()) ||
			dateValue.toISOString().slice(0, 10) !== date ||
			Number(date.slice(0, 4)) < 2000
		)
			throw new FormInputError('Enter a valid date.');
		const time = field(form, 'time', 'preferred time', 8);
		if (!timeOptions.has(time)) throw new FormInputError('Select a time from the list.');
		const gameType = field(form, 'gameType', 'game type', 20);
		if (!['board-games', 'video-games', 'both'].includes(gameType))
			throw new FormInputError('Select a game type from the list.');
		const payment = field(form, 'paymentArrangements', 'payment arrangements', 20);
		if (!['individual', 'one-bill', 'other'].includes(payment))
			throw new FormInputError('Select a payment option from the list.');
		const additional = field(
			form,
			'additionalRequirements',
			'additional requirements',
			FORM_TEXT_LIMIT,
			true,
			true
		);
		const displayDate = dateValue.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC'
		});
		subject = `Large Group Request: ${displayDate} · ${peopleCount} people · ${organizerName}`;
		html = `<h1>New Large Group Reservation Request</h1><h2>Contact Information</h2>
		<p><strong>Organizer Name:</strong> ${escapeHtml(organizerName)}</p><p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
		<p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Organization:</strong> ${escapeHtml(organization || 'Not provided')}</p>
		<h2>Event Details</h2><p><strong>Number of People:</strong> ${peopleCount}</p><p><strong>Preferred Date:</strong> ${date}</p>
		<p><strong>Preferred Time:</strong> ${time}</p><p><strong>Game Type:</strong> ${gameType}</p><p><strong>Payment Arrangements:</strong> ${payment}</p>
		<h2>Additional Requirements</h2><p style="white-space: pre-wrap">${escapeHtml(additional || 'None provided')}</p>`;
	} else {
		const name = field(form, 'name', 'name', 120);
		const message = field(form, 'message', 'message', FORM_TEXT_LIMIT, false, true);
		subject = 'New Contact Form Submission';
		html = `<h1>New Contact Form Submission</h1><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p style="white-space: pre-wrap"><strong>Message:</strong> ${escapeHtml(message)}</p>`;
	}
	const mail = {
		from: 'send@levelonegamepub.com',
		to: ['levelonereservations@gmail.com'],
		replyTo: email,
		subject,
		html
	};
	const contentHash = createHash('sha256').update(JSON.stringify(mail)).digest('hex');
	return { mail, idempotencyKey: `website-form/${submissionId}/${contentHash}` };
}

const providerErrorCodes = new Set([
	'invalid_idempotency_key',
	'validation_error',
	'missing_api_key',
	'restricted_api_key',
	'invalid_api_key',
	'not_found',
	'method_not_allowed',
	'invalid_idempotent_request',
	'concurrent_idempotent_requests',
	'invalid_attachment',
	'invalid_from_address',
	'invalid_access',
	'invalid_parameter',
	'invalid_region',
	'missing_required_field',
	'monthly_quota_exceeded',
	'daily_quota_exceeded',
	'rate_limit_exceeded',
	'security_error',
	'application_error',
	'internal_server_error'
]);

function recordProviderFailure(error: unknown) {
	const details =
		error !== null && typeof error === 'object' ? (error as Record<string, unknown>) : {};
	const code =
		typeof details.name === 'string' && providerErrorCodes.has(details.name)
			? details.name
			: 'unknown';
	const status = details.statusCode;
	console.warn('website_form', {
		event: 'provider_failed',
		code,
		...(typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599
			? { status }
			: {})
	});
}

export async function handleFormEmail(
	request: Request,
	url: URL,
	send: (
		mail: FormMail,
		options: { idempotencyKey: string }
	) => Promise<{ error: unknown; data?: { id: string } | null }>
): Promise<Response> {
	const headers = { 'cache-control': 'no-store' };
	const failedSend = () =>
		Response.json(
			{ success: false, error: 'We could not send your message. Please try again later.' },
			{ status: 502, headers }
		);
	let prepared: ReturnType<typeof prepareFormMail>;
	try {
		checkFormOrigin(request, url);
		prepared = prepareFormMail(await readForm(request));
	} catch (error) {
		if (error instanceof FormInputError) {
			const category =
				error.status === 403
					? 'origin'
					: error.status === 413
						? 'body_size'
						: error.status === 415
							? 'body_type'
							: 'fields';
			console.warn('website_form', { event: 'input_rejected', category, status: error.status });
			return Response.json(
				{ success: false, error: error.message },
				{ status: error.status, headers }
			);
		}
		console.warn('website_form', { event: 'request_failed', code: 'unknown' });
		return failedSend();
	}
	if (!prepared) {
		console.info('website_form', { event: 'honeypot_dropped' });
		return Response.json({ success: true }, { headers });
	}
	try {
		const result = await send(prepared.mail, { idempotencyKey: prepared.idempotencyKey });
		if (result.error || !result.data?.id) {
			recordProviderFailure(result.error);
			return failedSend();
		}
	} catch {
		console.warn('website_form', { event: 'transport_failed', code: 'transport_error' });
		return failedSend();
	}
	return Response.json({ success: true }, { headers });
}
