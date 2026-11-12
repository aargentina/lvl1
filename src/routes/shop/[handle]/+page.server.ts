import { addSaleProduct, loadSaleProduct } from '$lib/server/shop-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadSaleProduct(event, 'shop');
export const actions: Actions = { add: (event) => addSaleProduct(event, 'shop') };
