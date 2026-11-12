import { error } from '@sveltejs/kit';

export function load() {
	error(404, 'Open the booking link we sent you.');
}
