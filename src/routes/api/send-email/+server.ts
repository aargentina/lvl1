import { RESEND_API_KEY } from '$env/static/private';
import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { handleFormEmail } from '$lib/server/formEmail';
import { saveEmailOffers } from '$lib/server/marketingSignup';
import type { RequestHandler } from './$types';

const resend = new Resend(RESEND_API_KEY);

export const prerender = false;

export const POST: RequestHandler = ({ request, url }) =>
	handleFormEmail(
		request,
		url,
		(mail, options) => resend.emails.send(mail, options),
		({ form, email, name }) => saveEmailOffers(form, email, name, env)
	);
