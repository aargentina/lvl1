export interface WebsiteMenuStockItem {
	key: string;
	name: string;
	unavailable: boolean;
	source: 'toast' | 'override' | 'default';
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
