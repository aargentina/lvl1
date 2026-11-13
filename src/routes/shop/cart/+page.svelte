<script lang="ts">
	import ShopCartView from '$lib/components/ShopCartView.svelte';
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><meta name="robots" content="noindex, nofollow" /></svelte:head>

<ShopCartView {data} {form} scope="shop" />
