<script lang="ts">
	import ShopProductView from '$lib/components/ShopProductView.svelte';
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<ShopProductView {data} {form} scope="shop" />
