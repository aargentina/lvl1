import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { readMenuStock, UPSTREAM_STOCK_TIMEOUT_MS } from '$lib/menuStock';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => {
	const endpoint = env.DASHBOARD_STOCK_API_URL?.trim();
	const token = env.DASHBOARD_STOCK_API_TOKEN?.trim();
	if (!endpoint || !token) {
		return json({ ok: false, error: 'Menu stock is not configured' }, { status: 503 });
	}

	try {
		const payload = await readMenuStock(fetch, endpoint, UPSTREAM_STOCK_TIMEOUT_MS, {
			headers: { Authorization: `Bearer ${token}` }
		});
		return json(payload, {
			headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15' }
		});
	} catch {
		console.error('[menu-stock] stock service failed');
		return json({ ok: false, error: 'Menu stock is temporarily unavailable' }, { status: 503 });
	}
};
