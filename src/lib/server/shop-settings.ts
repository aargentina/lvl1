import type { Client } from '@prismicio/client';
import type { Cookies } from '@sveltejs/kit';
import { readPrismic } from './prismic-read';

export type ShopSettings = {
	heading: string;
	intro: string;
	banner: { url: string; alt: string } | null;
	notice: string;
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function banner(value: unknown): ShopSettings['banner'] {
	if (!value || typeof value !== 'object' || !('url' in value)) return null;
	if (typeof value.url !== 'string') return null;
	try {
		const url = new URL(value.url);
		if (
			url.protocol !== 'https:' ||
			url.username ||
			url.password ||
			url.port ||
			(url.hostname !== 'images.prismic.io' && !url.hostname.endsWith('.cdn.prismic.io'))
		)
			return null;
		return { url: url.href, alt: 'alt' in value ? text(value.alt) : '' };
	} catch {
		return null;
	}
}

export async function loadShopSettings(
	client: Pick<Client, 'getSingle' | 'disableAutoPreviews' | 'queryLatestContent'>,
	collectionDescription: string | Promise<string>,
	cookies?: Pick<Cookies, 'delete'>
): Promise<ShopSettings> {
	try {
		const document = await readPrismic(client, cookies, (options) =>
			client.getSingle('shop_settings', options)
		);
		return {
			heading: text(document.data.heading) || 'Shop',
			intro: text(document.data.intro),
			banner: banner(document.data.banner),
			notice: text(document.data.notice)
		};
	} catch {
		// A missing or unavailable settings document must not block public sales.
		return {
			heading: 'Shop',
			intro: text(await collectionDescription) || 'Shop items from Level One Game Pub.',
			banner: { url: '/redesign/games-bg.jpg', alt: '' },
			notice: ''
		};
	}
}
