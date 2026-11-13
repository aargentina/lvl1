import { cookie, PreviewTokenExpiredError, type Client } from '@prismicio/client';
import type { Cookies } from '@sveltejs/kit';

type ReadOptions = {
	fetchOptions: { signal: AbortSignal; cache: 'no-store' };
};

type PreviewClient = Pick<Client, 'disableAutoPreviews' | 'queryLatestContent'>;

/** Read a document with one deadline and one recovery for an expired preview. */
export async function readPrismic<T>(
	client: PreviewClient,
	cookies: Pick<Cookies, 'delete'> | undefined,
	read: (options: ReadOptions) => Promise<T>
): Promise<T> {
	const options: ReadOptions = {
		fetchOptions: { signal: AbortSignal.timeout(5000), cache: 'no-store' }
	};
	try {
		return await read(options);
	} catch (cause) {
		if (!(cause instanceof PreviewTokenExpiredError)) throw cause;
		// Keep cart cookies and every other source unchanged.
		cookies?.delete(cookie.preview, { path: '/' });
		client.disableAutoPreviews();
		client.queryLatestContent();
		return await read(options);
	}
}
