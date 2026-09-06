<script lang="ts">
	import { asText, type Content } from '@prismicio/client';
	import { SliceZone } from '@prismicio/svelte';
	import { page } from '$app/stores';
	import { onMount, type SvelteComponent } from 'svelte';

	import MenuNav from '$lib/components/MenuNav.svelte';
	import {
		readMenuStock,
		CLIENT_STOCK_TIMEOUT_MS,
		type WebsiteMenuStockItem
	} from '$lib/menuStock';
	import { components } from '$lib/slices';
	import FoodLiveMenuSection from '$lib/slices/FoodLiveMenu/FoodLiveMenuSection.svelte';

	let { data } = $props();
	let stockByKey = $state<Record<string, WebsiteMenuStockItem>>({});
	let stockPreview = $state(false);
	let failedStockRefreshes = 0;
	// Prismic still publishes a Svelte 4 component type. The site uses Svelte 5 components.
	// Keep this compatibility cast local to the trial page.
	/* eslint-disable @typescript-eslint/no-explicit-any */
	type LegacySliceComponents = Record<
		string,
		new (...args: any[]) => SvelteComponent<any, any, any>
	>;
	/* eslint-enable @typescript-eslint/no-explicit-any */
	const foodLiveComponents = {
		...components,
		image_cards: FoodLiveMenuSection
	} as unknown as LegacySliceComponents;

	onMount(() => {
		stockPreview = new URLSearchParams(window.location.search).get('stock-preview') === '1';
		if (stockPreview) return;
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
				stockByKey = Object.fromEntries(payload.items.map((item) => [item.key, item]));
				failedStockRefreshes = 0;
			} catch (error) {
				if (!disposed) {
					failedStockRefreshes += 1;
					if (failedStockRefreshes >= 5) stockByKey = {};
					console.error('[food-live] stock refresh failed', error);
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
		(slice) => slice.slice_type === 'image_cards'
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
		.filter((section) => section.label);
</script>

<svelte:head>
	<title>{$page.data.title}</title>
	<meta name="robots" content="noindex,nofollow" />
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

<div class="border-y-4 border-red bg-ivory px-4 py-3 text-center font-body text-sm text-ink">
	{#if stockPreview}
		<strong>Sample mode:</strong> The first items show sample labels for review.
	{:else}
		<strong>Trial menu:</strong> This page uses live Toast availability and new-item labels.
	{/if}
</div>

<SliceZone
	slices={data.page.data.slices}
	components={foodLiveComponents}
	context={{ stockByKey, stockPreview }}
/>
