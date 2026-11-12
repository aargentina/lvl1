<script lang="ts">
	import ShopCartView from '$lib/components/ShopCartView.svelte';
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<ShopCartView {data} {form} scope="booking" />
