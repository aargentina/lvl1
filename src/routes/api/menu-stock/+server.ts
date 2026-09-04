import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { isFreshStockCheck, type WebsiteMenuStockItem } from '$lib/menuStock';

interface DashboardStockPayload {
	ok?: boolean;
	checkedAt?: string;
	stockCheckedAt?: string;
	items?: WebsiteMenuStockItem[];
}

export async function GET({ fetch }) {
	const endpoint = env.DASHBOARD_STOCK_API_URL?.trim();
	const token = env.DASHBOARD_STOCK_API_TOKEN?.trim();
	if (!endpoint || !token) {
		return json({ ok: false, error: 'Menu stock is not configured' }, { status: 503 });
	}

	try {
		const response = await fetch(endpoint, {
			headers: { Authorization: `Bearer ${token}` },
			cache: 'no-store'
		});
		if (!response.ok) throw new Error(`Stock service returned ${response.status}`);
		const payload = (await response.json()) as DashboardStockPayload;
		if (!payload.ok || !Array.isArray(payload.items)) {
			throw new Error('Stock service returned an invalid response');
		}
		if (!isFreshStockCheck(payload.stockCheckedAt)) {
			throw new Error('Stock service data is stale');
		}
		return json(payload, {
			headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15' }
		});
	} catch (error) {
		console.error('[menu-stock] stock service failed', error);
		return json({ ok: false, error: 'Menu stock is temporarily unavailable' }, { status: 503 });
	}
}
