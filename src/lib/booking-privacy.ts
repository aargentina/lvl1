export const BOOKING_TITLE = 'Booking | Level One Game Pub';
export const BOOKING_ROBOTS = 'noindex, nofollow, nosnippet, noimageindex';
export const BOOKING_HEADERS = {
	'Cache-Control': 'private, no-store',
	'X-Robots-Tag': BOOKING_ROBOTS,
	// Hide the booking path without making native form POST Origin become null.
	'Referrer-Policy': 'strict-origin'
} as const;

export function isBookingPath(pathname: string): boolean {
	let normalized: string;
	try {
		normalized = decodeURIComponent(pathname);
	} catch {
		// A malformed later segment must not remove booking response controls.
		normalized = pathname.replace(/%[\da-f]{2}/gi, (part) =>
			String.fromCharCode(Number.parseInt(part.slice(1), 16))
		);
		if (normalized.startsWith('/bookings%')) return true;
	}
	return normalized === '/bookings' || normalized.startsWith('/bookings/');
}

export function filterBookingAnalytics<T extends { url: string }>(event: T): T | null {
	try {
		const url = new URL(event.url, 'https://levelonegamepub.com');
		if (isBookingPath(url.pathname)) return null;
	} catch {
		// Keep the existing behavior for a URL that cannot be parsed.
	}
	return event;
}
