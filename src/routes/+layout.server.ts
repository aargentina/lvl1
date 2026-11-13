import { asLink, asText, isFilled } from '@prismicio/client';
import { dev } from '$app/environment';
import { createClient } from '$lib/prismicio';
import { readPrismic } from '$lib/server/prismic-read';

// Only the server knows which deployment this is. Production is anything that
// isn't `npm run dev` or an explicit Vercel Preview build. Read straight from
// process.env: these pages prerender, and $env/dynamic/private is unreadable then.
const vercelEnv = process.env.VERCEL_ENV;
const stockPreviewAllowed = dev || vercelEnv === 'preview' || vercelEnv === 'development';

export const prerender = 'auto';

const fallbackLinks = [
	{ label: 'Menu', href: '/select' },
	{ label: 'Games', href: '/board-video' },
	{ label: 'Reservations', href: '/reservations' },
	{ label: 'Events', href: '/events' },
	{ label: 'Corporate Parties', href: '/privateevents' },
	{ label: 'Contact Us', href: '/contact' },
	{ label: 'FAQ', href: '/hiw' },
	{ label: 'Gift Cards', href: 'https://order.toasttab.com/egiftcards/level-one-14-waller-st' },
	{ label: 'Shop', href: '/shop' }
];

export async function load({ fetch, cookies }) {
	const client = createClient({ fetch, cookies });

	let links;
	try {
		const nav = await readPrismic(client, cookies, (options) =>
			client.getSingle('navigation', options)
		);
		links = nav.data.links
			.filter((item) => isFilled.link(item.link))
			.map((item) => ({ label: asText(item.label), href: asLink(item.link) ?? '#' }));
	} catch {
		// A failed navigation read must not stop the shop or reservation payments.
		links = fallbackLinks.map((item) => ({ ...item }));
	}
	if (
		!links.some(
			(item) => item.href === '/shop' || item.href === 'https://www.levelonegamepub.com/shop'
		)
	) {
		links.push({ label: 'Shop', href: '/shop' });
	}

	return { links, stockPreviewAllowed };
}
