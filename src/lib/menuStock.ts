export interface WebsiteMenuStockItem {
	key: string;
	name: string;
	unavailable: boolean;
	source: 'toast' | 'override' | 'default';
}

export const MAX_STOCK_AGE_MS = 45 * 60 * 1000;

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
