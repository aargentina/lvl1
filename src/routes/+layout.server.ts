import { asLink, asText, isFilled } from '@prismicio/client';
import { dev } from '$app/environment';
import { createClient } from '$lib/prismicio';

// Only the server knows which deployment this is. Production is anything that
// isn't `npm run dev` or an explicit Vercel Preview build. Read straight from
// process.env: these pages prerender, and $env/dynamic/private is unreadable then.
const vercelEnv = process.env.VERCEL_ENV;
const stockPreviewAllowed = dev || vercelEnv === 'preview' || vercelEnv === 'development';

export const prerender = 'auto';

export async function load({ fetch, cookies }) {
	const client = createClient({ fetch, cookies });

	const nav = await client.getSingle('navigation');

	const links = nav.data.links
		.filter((item) => isFilled.link(item.link))
		.map((item) => ({
			label: asText(item.label),
			href: asLink(item.link) ?? '#'
		}));
	if (
		!links.some(
			(item) => item.href === '/shop' || item.href === 'https://www.levelonegamepub.com/shop'
		)
	) {
		links.push({ label: 'Shop', href: '/shop' });
	}

	return { links, stockPreviewAllowed };
}
