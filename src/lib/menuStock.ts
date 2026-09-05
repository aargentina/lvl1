export interface WebsiteMenuStockItem {
	key: string;
	name: string;
	unavailable: boolean;
	source: 'toast' | 'override' | 'default';
}

export const MAX_STOCK_AGE_MS = 45 * 60 * 1000;
export const UPSTREAM_STOCK_TIMEOUT_MS = 8_000;
export const CLIENT_STOCK_TIMEOUT_MS = 10_000;

export interface WebsiteMenuStockPayload {
	ok: true;
	checkedAt?: string;
	stockCheckedAt: string;
	items: WebsiteMenuStockItem[];
}

export function isMenuStockPayload(value: unknown): value is WebsiteMenuStockPayload {
	if (!value || typeof value !== 'object') return false;
	const payload = value as Record<string, unknown>;
	if (payload.ok !== true || !isFreshStockCheck(payload.stockCheckedAt)) return false;
	if (
		payload.checkedAt !== undefined &&
		(typeof payload.checkedAt !== 'string' || !Number.isFinite(Date.parse(payload.checkedAt)))
	)
		return false;
	if (!Array.isArray(payload.items)) return false;
	const keys = new Set<string>();
	for (const item of payload.items) {
		if (
			!item ||
			typeof item !== 'object' ||
			typeof item.key !== 'string' ||
			!item.key.trim() ||
			keys.has(item.key) ||
			typeof item.name !== 'string' ||
			typeof item.unavailable !== 'boolean' ||
			!['toast', 'override', 'default'].includes(item.source)
		)
			return false;
		keys.add(item.key);
	}
	return true;
}

// The deadline covers both response headers and the response body.
export async function readMenuStock(
	fetcher: typeof fetch,
	endpoint: string,
	timeoutMs: number,
	init: RequestInit = {}
): Promise<WebsiteMenuStockPayload> {
	const controller = new AbortController();
	const cancel = () => controller.abort();
	let rejectAbort: () => void = () => {};
	const aborted = new Promise<never>((_resolve, reject) => {
		rejectAbort = () => reject(new Error('Stock request stopped or timed out'));
		controller.signal.addEventListener('abort', rejectAbort, { once: true });
	});
	init.signal?.addEventListener('abort', cancel, { once: true });
	if (init.signal?.aborted) cancel();
	const timer = setTimeout(cancel, timeoutMs);
	try {
		return await Promise.race([
			aborted,
			(async () => {
				controller.signal.throwIfAborted();
				const response = await fetcher(endpoint, {
					...init,
					cache: 'no-store',
					signal: controller.signal
				});
				if (!response.ok) throw new Error('Stock service request failed');
				const payload: unknown = await response.json();
				if (!isMenuStockPayload(payload)) throw new Error('Stock service data is invalid or stale');
				return payload;
			})()
		]);
	} finally {
		clearTimeout(timer);
		init.signal?.removeEventListener('abort', cancel);
		controller.signal.removeEventListener('abort', rejectAbort);
	}
}

export function isFreshStockCheck(
	value: unknown,
	now = Date.now(),
	maxAgeMs = MAX_STOCK_AGE_MS
): value is string {
	if (typeof value !== 'string') return false;
	const checkedAt = Date.parse(value);
	return Number.isFinite(checkedAt) && checkedAt <= now + 60_000 && now - checkedAt <= maxAgeMs;
}

export function websiteMenuKey(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[\u2019']/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}
