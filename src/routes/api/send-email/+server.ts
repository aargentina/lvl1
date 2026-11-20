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
		async ({ form, email, name }) => {
			// saveEmailOffers never throws; throwing here is what logs offers_save_failed.
			if ((await saveEmailOffers(form, email, name, env)) !== 'saved') throw new Error('not saved');
		}
	);
