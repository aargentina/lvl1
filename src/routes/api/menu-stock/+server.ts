import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';

export async function GET({ fetch }) {
	const endpoint = env.DASHBOARD_STOCK_API_URL?.trim();
	if (!endpoint) {
		return json({ ok: false, error: 'Menu stock is not configured' }, { status: 503 });
	}

	try {
		const response = await fetch(endpoint, { cache: 'no-store' });
		if (!response.ok) throw new Error(`Stock service returned ${response.status}`);
		const payload = await response.json();
		return json(payload, {
			headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' }
		});
	} catch (error) {
		console.error('[menu-stock] stock service failed', error);
		return json({ ok: false, error: 'Menu stock is temporarily unavailable' }, { status: 503 });
	}
}
