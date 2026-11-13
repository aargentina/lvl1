import { redirect, error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { BOOKING_HEADERS, isBookingPath } from '$lib/booking-privacy';

// Legacy WordPress URL patterns that should return 410 Gone
const gonePatterns = [
	/^\/board_game\//,
	/^\/video_game\//,
	/^\/events\//,
	/^\/author\//,
	/^\/wp-content\//,
	/^\/wp-admin/,
	/^\/wp-json\//,
	/^\/wp-includes\//,
	/^\/category\//,
	/^\/tag\//,
	/^\/page\//,
	/^\/blog\//
];

// Legacy URLs that should redirect to new locations
const redirectMap: Record<string, string> = {
	'/menu/food': '/food',
	'/menu/drinks': '/drinks',
	'/pages/home': '/',
	'/pages/menu': '/select'
};

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (
		(event.request.method === 'GET' || event.request.method === 'HEAD') &&
		/^\/preview\/shop(?:\/|$)/.test(path)
	) {
		// Prismic's client prefixes links from normal page previews. Sales routes
		// use their own loaders, so keep the preview cookie and open that route.
		return new Response(null, {
			status: 307,
			headers: {
				Location: `${path.slice('/preview'.length)}${event.url.search}`,
				'Cache-Control': 'private, no-store',
				'X-Robots-Tag': 'noindex, nofollow'
			}
		});
	}

	// Check for exact redirects first
	if (redirectMap[path]) {
		redirect(301, redirectMap[path]);
	}

	// Check for legacy WordPress patterns that should be 410 Gone
	for (const pattern of gonePatterns) {
		if (pattern.test(path)) {
			error(410, 'This page has been permanently removed.');
		}
	}

	const response = await resolve(event);
	if (!isBookingPath(path)) return response;

	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(BOOKING_HEADERS)) headers.set(name, value);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};
