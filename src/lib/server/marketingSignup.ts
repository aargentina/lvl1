/**
 * "Email me with news and offers" on the Contact Us and Large group forms (owner request, 2026-11-20).
 * The website has no subscriber database. A Yes is sent to the dashboard, which saves it for the
 * Email subscribers page. The key stays on this server. An empty box sends nothing.
 */
export const EMAIL_OFFERS_TEXT = 'Email me with news and offers';
export type SignupForm = 'contact' | 'large_reso';
export type SignupResult = 'no' | 'saved' | 'not_saved';
type Env = Record<string, string | undefined>;

/** Save one Yes. It never throws, so a failure cannot stop the form email. */
export async function saveEmailOffers(
	form: SignupForm,
	email: string,
	name: string,
	env: Env,
	fetcher: typeof fetch = fetch
): Promise<SignupResult> {
	const url = (env.MARKETING_SIGNUP_URL ?? '').trim();
	const key = env.MARKETING_SIGNUP_WEBSITE_KEY ?? '';
	if (!/^https:\/\/[^/]+\/api\/marketing-signups$/.test(url) || key.length < 32) return 'not_saved';
	try {
		const response = await fetcher(url, {
			method: 'POST',
			headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ form, email: email.trim(), name: name.trim().slice(0, 500) }),
			redirect: 'error',
			signal: AbortSignal.timeout(8000)
		});
		return response.ok ? 'saved' : 'not_saved';
	} catch {
		return 'not_saved';
	}
}
