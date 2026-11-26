import { NotFoundError, type Client } from '@prismicio/client';
import { error } from '@sveltejs/kit';
import type { AllDocumentTypes, PageDocument } from '../prismicio-types';

// Prismic throws NotFoundError when no page has this UID. Without this check
// SvelteKit turns it into a 500, and Search Console reports old addresses such
// as /contact-us as server errors. A missing page is a 404.
export async function getPageOr404(
	client: Pick<Client<AllDocumentTypes>, 'getByUID'>,
	uid: string
): Promise<PageDocument> {
	try {
		return await client.getByUID('page', uid);
	} catch (cause) {
		if (cause instanceof NotFoundError) {
			error(404, 'Not found');
		}
		throw cause;
	}
}
