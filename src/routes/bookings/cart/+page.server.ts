import {
	loadSaleCart,
	updateSaleCart,
	removeSaleCart,
	checkoutSaleCart
} from '$lib/server/shop-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadSaleCart(event, 'booking');
export const actions: Actions = {
	update: (event) => updateSaleCart(event, 'booking'),
	remove: (event) => removeSaleCart(event, 'booking'),
	checkout: (event) => checkoutSaleCart(event, 'booking')
};
