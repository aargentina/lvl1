export type ShopScope = 'shop' | 'booking';

export function shopRoot(scope: ShopScope = 'shop') {
	return scope === 'booking' ? '/bookings' : '/shop';
}

export type ShopMoney = { amount: string; currencyCode: string };
export type ShopImage = {
	url: string;
	altText: string | null;
	width: number | null;
	height: number | null;
};
export type ShopPageInfo = { hasNextPage: boolean; endCursor: string | null };
export type ShopProductSummary = {
	id: string;
	handle: string;
	title: string;
	description: string;
	availableForSale: boolean;
	featuredImage: ShopImage | null;
	priceRange: { minVariantPrice: ShopMoney; maxVariantPrice: ShopMoney };
};
export type ShopVariant = {
	id: string;
	title: string;
	availableForSale: boolean;
	price: ShopMoney;
	image: ShopImage | null;
	selectedOptions: { name: string; value: string }[];
};
export type ShopProduct = ShopProductSummary & { variants: ShopVariant[] };
export type ShopCollection = {
	title: string;
	description: string;
	products: ShopProductSummary[];
	pageInfo: ShopPageInfo;
};
export type ShopCartLine = {
	id: string;
	quantity: number;
	variant: {
		id: string;
		title: string;
		price: ShopMoney;
		image: ShopImage | null;
		product: { handle: string; title: string };
	};
};
export type ShopCart = {
	totalQuantity: number;
	lines: ShopCartLine[];
	cost: { subtotalAmount: ShopMoney; totalAmount: ShopMoney; totalTaxAmount: ShopMoney | null };
};
