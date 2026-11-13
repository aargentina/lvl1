import { isBookingPath } from './booking-privacy';

export function crossesBookingBoundary(from: URL, to: URL) {
	return from.origin === to.origin && isBookingPath(from.pathname) !== isBookingPath(to.pathname);
}
