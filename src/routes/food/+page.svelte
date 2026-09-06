<script lang="ts">
	import { asText, type Content } from '@prismicio/client';
	import { SliceZone } from '@prismicio/svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	import { components } from '$lib/slices';
	import MenuNav from '$lib/components/MenuNav.svelte';
	import {
		readMenuStock,
		CLIENT_STOCK_TIMEOUT_MS,
		type WebsiteMenuStockItem
	} from '$lib/menuStock';

	let { data } = $props();
	let stockPreview = $state(false);
	let stockByKey = $state<Record<string, WebsiteMenuStockItem>>({});
	let failedStockRefreshes = 0;

	onMount(() => {
		stockPreview = new URLSearchParams(window.location.search).get('stock-preview') === '1';
		const controller = new AbortController();
		let inFlight = false;
		let disposed = false;
		const loadStock = async () => {
			if (inFlight || disposed) return;
			inFlight = true;
			try {
				const payload = await readMenuStock(fetch, '/api/menu-stock', CLIENT_STOCK_TIMEOUT_MS, {
					signal: controller.signal
				});
				if (disposed) return;
				const nextStock = Object.fromEntries(payload.items.map((item) => [item.key, item]));
				stockByKey = nextStock;
				failedStockRefreshes = 0;
			} catch (error) {
				if (!disposed) {
					failedStockRefreshes += 1;
					if (failedStockRefreshes >= 5) stockByKey = {};
					console.error('[food-menu] stock refresh failed', error);
				}
			} finally {
				inFlight = false;
			}
		};
		void loadStock();
		const interval = window.setInterval(() => {
			if (document.visibilityState === 'visible') void loadStock();
		}, 30_000);
		return () => {
			disposed = true;
			controller.abort();
			window.clearInterval(interval);
		};
	});

	const menuSlices = data.page.data.slices.filter(
		(s) => s.slice_type === 'image_cards'
	) as Content.ImageCardsSlice[];

	const sections = menuSlices
		.map((slice) => {
			const label = asText(slice.primary.heading);
			return {
				label,
				id: label
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/(^-|-$)/g, '')
			};
		})
		.filter((s) => s.label);
</script>

<svelte:head>
	<title>{$page.data.title}</title>
	{#if $page.data.meta_description}
		<meta name="description" content={$page.data.meta_description} />
	{/if}
	{#if $page.data.meta_title}
		<meta name="og:title" content={$page.data.meta_title} />
	{/if}
	{#if $page.data.meta_image}
		<meta name="og:image" content={$page.data.meta_image.url} />
		<meta name="twitter:card" content="summary_large_image" />
	{/if}
</svelte:head>

{#if sections.length > 0}
	<MenuNav {sections} />
	<div class="pt-14"></div>
{/if}

{#if stockPreview}
	<div class="border-y-4 border-red bg-ivory px-4 py-3 text-center font-body text-sm text-ink">
		<strong>Menu label preview:</strong> Sample items show NEW and temporarily unavailable tags. These
		tags use sample data.
	</div>
{/if}

<SliceZone slices={data.page.data.slices} {components} context={{ stockByKey }} />
