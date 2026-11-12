import {
	loadSaleCart,
	updateSaleCart,
	removeSaleCart,
	checkoutSaleCart
} from '$lib/server/shop-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadSaleCart(event, 'shop');
export const actions: Actions = {
	update: (event) => updateSaleCart(event, 'shop'),
	remove: (event) => removeSaleCart(event, 'shop'),
	checkout: (event) => checkoutSaleCart(event, 'shop')
};
