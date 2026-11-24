import { LEGAL_TITLE } from '$lib/legal';

export const prerender = true;

export function load() {
	return {
		title: `${LEGAL_TITLE} | Level One Game Pub`,
		meta_title: `${LEGAL_TITLE} | Level One Game Pub`,
		meta_description: 'Level One Game Pub privacy policy, terms and data deletion instructions.'
	};
}
