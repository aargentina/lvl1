import type {
	ShopCart,
	ShopCartLine,
	ShopCollection,
	ShopImage,
	ShopMoney,
	ShopPageInfo,
	ShopProduct,
	ShopProductSummary,
	ShopScope,
	ShopVariant
} from '../shop.ts';

export const SHOPIFY_DOMAIN = 'levelonegamepub.myshopify.com';
export const PUBLIC_SHOP_HANDLE = 'public-shop';
const CHECKOUT_HOSTS = new Set([SHOPIFY_DOMAIN, 'checkout.levelonegamepub.com']);
const ENDPOINT = `https://${SHOPIFY_DOMAIN}/api/2026-10/graphql.json`;
const MAX_COLLECTION_PAGES = 20;
const MAX_DETAIL_PAGES = 10;
const IMAGE = 'url altText width height';
const MONEY = 'amount currencyCode';
const SUMMARY = `id handle title description availableForSale featuredImage { ${IMAGE} }
 priceRange { minVariantPrice { ${MONEY} } maxVariantPrice { ${MONEY} } }`;
const VARIANT = `id title availableForSale price { ${MONEY} } image { ${IMAGE} }
 selectedOptions { name value }`;
const CART = `id totalQuantity cost { subtotalAmount { ${MONEY} } totalAmount { ${MONEY} }
 totalTaxAmount { ${MONEY} } } lines(first: 100, after: $after) {
 pageInfo { hasNextPage endCursor } nodes { id quantity merchandise {
 ... on ProductVariant { id title price { ${MONEY} } image { ${IMAGE} } product { handle title } }
 } } }`;

export type CartResult = {
	cart: ShopCart | null;
	cartId: string | null;
	userErrors: string[];
	warnings: string[];
};

function invalid(): never {
	throw new Error('The shop returned incomplete data. Please try again.');
}
function object(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid();
	return value as Record<string, unknown>;
}
function string(value: unknown): string {
	if (typeof value !== 'string') invalid();
	return value;
}
function nonempty(value: unknown): string {
	const result = string(value);
	if (!result) invalid();
	return result;
}
function bool(value: unknown): boolean {
	if (typeof value !== 'boolean') invalid();
	return value;
}
function integer(value: unknown, min = 0): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) invalid();
	return value;
}
function array(value: unknown): unknown[] {
	if (!Array.isArray(value)) invalid();
	return value;
}
function money(value: unknown): ShopMoney {
	const row = object(value),
		amount = string(row.amount),
		currencyCode = string(row.currencyCode);
	if (
		!/^\d+(?:\.\d+)?$/.test(amount) ||
		!Number.isFinite(Number(amount)) ||
		!/^[A-Z]{3}$/.test(currencyCode)
	)
		invalid();
	return { amount, currencyCode };
}
function image(value: unknown): ShopImage | null {
	if (value === null) return null;
	const row = object(value),
		url = nonempty(row.url);
	try {
		if (new URL(url).protocol !== 'https:') invalid();
	} catch {
		invalid();
	}
	return {
		url,
		altText: row.altText === null ? null : string(row.altText),
		width: row.width === null ? null : integer(row.width, 1),
		height: row.height === null ? null : integer(row.height, 1)
	};
}
function page(value: unknown): ShopPageInfo {
	const row = object(value),
		hasNextPage = bool(row.hasNextPage);
	const endCursor = row.endCursor === null ? null : nonempty(row.endCursor);
	if (hasNextPage && !endCursor) invalid();
	return { hasNextPage, endCursor };
}
function summary(value: unknown): ShopProductSummary {
	const row = object(value),
		priceRange = object(row.priceRange);
	return {
		id: nonempty(row.id),
		handle: nonempty(row.handle),
		title: string(row.title),
		description: string(row.description),
		availableForSale: bool(row.availableForSale),
		featuredImage: image(row.featuredImage),
		priceRange: {
			minVariantPrice: money(priceRange.minVariantPrice),
			maxVariantPrice: money(priceRange.maxVariantPrice)
		}
	};
}
function variant(value: unknown): ShopVariant {
	const row = object(value);
	return {
		id: nonempty(row.id),
		title: string(row.title),
		availableForSale: bool(row.availableForSale),
		price: money(row.price),
		image: image(row.image),
		selectedOptions: array(row.selectedOptions).map((value) => {
			const option = object(value);
			return { name: string(option.name), value: string(option.value) };
		})
	};
}
function cartLine(value: unknown): ShopCartLine {
	const row = object(value),
		merchandise = object(row.merchandise),
		product = object(merchandise.product);
	return {
		id: nonempty(row.id),
		quantity: integer(row.quantity),
		variant: {
			id: nonempty(merchandise.id),
			title: string(merchandise.title),
			price: money(merchandise.price),
			image: image(merchandise.image),
			product: { handle: nonempty(product.handle), title: string(product.title) }
		}
	};
}
function parseCart(value: unknown): { cart: ShopCart; id: string; pageInfo: ShopPageInfo } {
	const row = object(value),
		cost = object(row.cost),
		lines = object(row.lines);
	return {
		id: nonempty(row.id),
		pageInfo: page(lines.pageInfo),
		cart: {
			totalQuantity: integer(row.totalQuantity),
			lines: array(lines.nodes).map(cartLine),
			cost: {
				subtotalAmount: money(cost.subtotalAmount),
				totalAmount: money(cost.totalAmount),
				totalTaxAmount: cost.totalTaxAmount === null ? null : money(cost.totalTaxAmount)
			}
		}
	};
}
function validId(value: string, kind: string): void {
	if (!new RegExp(`^gid://shopify/${kind}/[^\\s]+$`).test(value))
		throw new Error('The selected shop item is invalid.');
}
function validQuantity(value: number): void {
	if (!Number.isSafeInteger(value) || value < 1 || value > 99)
		throw new Error('Choose a quantity from 1 to 99.');
}
function nextCursor(info: ShopPageInfo, seen: Set<string>): string | null {
	if (!info.hasNextPage) return null;
	const cursor = info.endCursor!;
	if (seen.has(cursor)) invalid();
	seen.add(cursor);
	return cursor;
}

export class ShopifyStorefront {
	private fetcher: typeof fetch;
	private buyerIp?: string;
	private writeVersion = 0;
	constructor(fetcher: typeof fetch, buyerIp?: string) {
		this.fetcher = fetcher;
		this.buyerIp = buyerIp;
	}

	private async request(
		query: string,
		variables: Record<string, unknown>
	): Promise<Record<string, unknown>> {
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (this.buyerIp) headers['Shopify-Storefront-Buyer-IP'] = this.buyerIp;
		let response: Response;
		try {
			response = await this.fetcher(ENDPOINT, {
				method: 'POST',
				headers,
				cache: 'no-store',
				signal: AbortSignal.timeout(10000),
				body: JSON.stringify({ query, variables })
			});
		} catch {
			throw new Error('The shop is not available. Please try again.');
		}
		if (!response.ok) throw new Error('The shop is not available. Please try again.');
		let payload: Record<string, unknown>;
		try {
			payload = object(await response.json());
		} catch {
			invalid();
		}
		if (payload.errors !== undefined && array(payload.errors).length) invalid();
		return object(payload.data);
	}

	async collection(after: string | null = null): Promise<ShopCollection> {
		const data = await this.request(
			`query PublicShop($handle: String!, $after: String) @inContext(country: CA, language: EN) {
		 collection(handle: $handle) { title description products(first: 24, after: $after, sortKey: COLLECTION_DEFAULT) {
		 pageInfo { hasNextPage endCursor } nodes { ${SUMMARY} } } } }`,
			{ handle: PUBLIC_SHOP_HANDLE, after }
		);
		const row = object(data.collection),
			products = object(row.products);
		return {
			title: string(row.title),
			description: string(row.description),
			products: array(products.nodes).map(summary),
			pageInfo: page(products.pageInfo)
		};
	}

	private async isMember(handle: string): Promise<boolean> {
		let after: string | null = null;
		const seen = new Set<string>();
		for (let index = 0; index < MAX_COLLECTION_PAGES; index++) {
			const data = await this.request(
				`query PublicShopMembership($handle: String!, $after: String) @inContext(country: CA, language: EN) {
			 collection(handle: $handle) { products(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { handle } } } }`,
				{ handle: PUBLIC_SHOP_HANDLE, after }
			);
			const products = object(object(data.collection).products);
			const handles = array(products.nodes).map((row) => nonempty(object(row).handle));
			const info = page(products.pageInfo);
			if (handles.includes(handle)) return true;
			after = nextCursor(info, seen);
			if (!after) return false;
		}
		invalid();
	}

	productReader(scope: ShopScope) {
		let membership: Promise<Set<string>> | undefined;
		let readVersion = this.writeVersion;
		const products = new Map<string, Promise<ShopProduct | null>>();
		const readMembership = async () => {
			const handles = new Set<string>(),
				seen = new Set<string>();
			let after: string | null = null;
			for (let index = 0; index < MAX_COLLECTION_PAGES; index++) {
				const data = await this.request(
					`query PublicShopMembership($handle: String!, $after: String) @inContext(country: CA, language: EN) {
				 collection(handle: $handle) { products(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { handle } } } }`,
					{ handle: PUBLIC_SHOP_HANDLE, after }
				);
				const pageData = object(object(data.collection).products);
				for (const row of array(pageData.nodes)) handles.add(nonempty(object(row).handle));
				after = nextCursor(page(pageData.pageInfo), seen);
				if (!after) return handles;
			}
			invalid();
		};
		// This reader belongs to one check. Never retain it across a cart write.
		return (handle: string): Promise<ShopProduct | null> => {
			if (readVersion !== this.writeVersion) {
				membership = undefined;
				products.clear();
				readVersion = this.writeVersion;
			}
			if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(handle)) return Promise.resolve(null);
			if (!products.has(handle)) {
				products.set(
					handle,
					(async () => {
						membership ??= readMembership();
						const isPublic = (await membership).has(handle);
						if (isPublic !== (scope === 'shop')) return null;
						return this.readProduct(handle);
					})()
				);
			}
			return products.get(handle)!;
		};
	}

	async product(handle: string): Promise<ShopProduct | null> {
		if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(handle)) return null;
		if (!(await this.isMember(handle))) return null;
		return this.readProduct(handle);
	}

	async bookingProduct(handle: string): Promise<ShopProduct | null> {
		if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(handle)) return null;
		// A complete membership read must exclude this handle before the direct read.
		if (await this.isMember(handle)) return null;
		return this.readProduct(handle);
	}

	private async readProduct(handle: string): Promise<ShopProduct | null> {
		let after: string | null = null,
			result: ShopProduct | null = null;
		const seen = new Set<string>(),
			ids = new Set<string>();
		for (let index = 0; index < MAX_DETAIL_PAGES; index++) {
			const data = await this.request(
				`query ShopProduct($handle: String!, $after: String) @inContext(country: CA, language: EN) {
			 product(handle: $handle) { ${SUMMARY} variants(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { ${VARIANT} } } } }`,
				{ handle, after }
			);
			if (data.product === null) return null;
			const row = object(data.product),
				base = summary(row),
				variants = object(row.variants);
			if (base.handle !== handle || (result && result.id !== base.id)) invalid();
			result ??= { ...base, variants: [] };
			for (const value of array(variants.nodes)) {
				const item = variant(value);
				if (ids.has(item.id)) invalid();
				ids.add(item.id);
				result.variants.push(item);
			}
			after = nextCursor(page(variants.pageInfo), seen);
			if (!after) return result;
		}
		invalid();
	}

	private async completeCart(first: ReturnType<typeof parseCart>): Promise<ShopCart> {
		const cart = first.cart,
			seen = new Set<string>(),
			ids = new Set(cart.lines.map((line) => line.id));
		if (ids.size !== cart.lines.length) invalid();
		let after = nextCursor(first.pageInfo, seen);
		for (let index = 1; after && index < MAX_DETAIL_PAGES; index++) {
			const data = await this.request(
				`query ShopCart($id: ID!, $after: String) { cart(id: $id) { ${CART} } }`,
				{ id: first.id, after }
			);
			if (data.cart === null) invalid();
			const next = parseCart(data.cart);
			if (
				next.id !== first.id ||
				next.cart.totalQuantity !== cart.totalQuantity ||
				JSON.stringify(next.cart.cost) !== JSON.stringify(cart.cost)
			)
				invalid();
			for (const line of next.cart.lines) {
				if (ids.has(line.id)) invalid();
				ids.add(line.id);
				cart.lines.push(line);
			}
			after = nextCursor(next.pageInfo, seen);
		}
		if (after || cart.lines.reduce((sum, line) => sum + line.quantity, 0) !== cart.totalQuantity)
			invalid();
		cart.lines = cart.lines.filter((line) => line.quantity > 0);
		return cart;
	}

	async cart(cartId: string): Promise<ShopCart | null> {
		validId(cartId, 'Cart');
		const data = await this.request(
			`query ShopCart($id: ID!, $after: String) { cart(id: $id) { ${CART} } }`,
			{ id: cartId, after: null }
		);
		if (data.cart === null) return null;
		const parsed = parseCart(data.cart);
		if (parsed.id !== cartId) invalid();
		return this.completeCart(parsed);
	}

	private async mutate(
		operation: string,
		declarations: string,
		argumentsText: string,
		variables: Record<string, unknown>,
		creating = false
	): Promise<CartResult> {
		// A lost write response can still mean that Shopify changed the cart.
		this.writeVersion++;
		const data = await this.request(
			`mutation ShopCartWrite(${declarations}, $after: String) { ${operation}(${argumentsText}) {
		 cart { ${CART} } userErrors { message } warnings { message } } }`,
			{ ...variables, after: null }
		);
		const row = object(data[operation]);
		const userErrors = array(row.userErrors).map((value) => nonempty(object(value).message));
		const warnings = array(row.warnings).map((value) => nonempty(object(value).message));
		if (row.cart === null) {
			if (!userErrors.length) invalid();
			return { cart: null, cartId: null, userErrors, warnings };
		}
		const parsed = parseCart(row.cart);
		if (!creating && parsed.id !== variables.cartId) invalid();
		return {
			cart: await this.completeCart(parsed),
			cartId: creating ? parsed.id : null,
			userErrors,
			warnings
		};
	}

	async createCart(variantId: string, quantity: number): Promise<CartResult> {
		validId(variantId, 'ProductVariant');
		validQuantity(quantity);
		return this.mutate(
			'cartCreate',
			'$input: CartInput!',
			'input: $input',
			{
				input: {
					buyerIdentity: { countryCode: 'CA' },
					lines: [{ merchandiseId: variantId, quantity }]
				}
			},
			true
		);
	}
	async addLines(cartId: string, variantId: string, quantity: number): Promise<CartResult> {
		validId(cartId, 'Cart');
		validId(variantId, 'ProductVariant');
		validQuantity(quantity);
		return this.mutate(
			'cartLinesAdd',
			'$cartId: ID!, $lines: [CartLineInput!]!',
			'cartId: $cartId, lines: $lines',
			{
				cartId,
				lines: [{ merchandiseId: variantId, quantity }]
			}
		);
	}
	async updateLine(cartId: string, lineId: string, quantity: number): Promise<CartResult> {
		validId(cartId, 'Cart');
		validId(lineId, 'CartLine');
		validQuantity(quantity);
		return this.mutate(
			'cartLinesUpdate',
			'$cartId: ID!, $lines: [CartLineUpdateInput!]!',
			'cartId: $cartId, lines: $lines',
			{
				cartId,
				lines: [{ id: lineId, quantity }]
			}
		);
	}
	async removeLine(cartId: string, lineId: string): Promise<CartResult> {
		validId(cartId, 'Cart');
		validId(lineId, 'CartLine');
		return this.mutate(
			'cartLinesRemove',
			'$cartId: ID!, $lineIds: [ID!]!',
			'cartId: $cartId, lineIds: $lineIds',
			{ cartId, lineIds: [lineId] }
		);
	}
	async checkoutUrl(cartId: string): Promise<string | null> {
		validId(cartId, 'Cart');
		const data = await this.request(
			'query ShopCheckout($id: ID!) { cart(id: $id) { checkoutUrl } }',
			{ id: cartId }
		);
		if (data.cart === null) return null;
		const value = nonempty(object(data.cart).checkoutUrl);
		try {
			const url = new URL(value);
			if (
				url.protocol !== 'https:' ||
				!CHECKOUT_HOSTS.has(url.hostname) ||
				url.port ||
				url.username ||
				url.password ||
				!url.pathname.startsWith('/cart/')
			)
				invalid();
		} catch {
			invalid();
		}
		return value;
	}
}
