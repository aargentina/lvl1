<script lang="ts">
	import { isFilled, asText, type Content } from '@prismicio/client';
	import { PrismicText } from '@prismicio/svelte';
	import { onMount } from 'svelte';

	import MenuItems from './MenuItems.svelte';
	import Heading from '$lib/components/Heading.svelte';
	import { websiteMenuKey, type WebsiteMenuStockItem } from '$lib/menuStock';
	import { isNewWithin } from '$lib/menuNew';

	interface Props {
		slice: Content.ImageCardsSlice;
		context?: {
			stockByKey?: Record<string, WebsiteMenuStockItem | boolean>;
			// Days a card keeps its NEW tag after its Prismic "New since" date (food 60, drinks 14).
			newDays?: number;
			// Test hook: fixed clock in ms. Pages leave it unset and use the visitor's clock.
			now?: number;
		};
	}

	let { slice, context = {} }: Props = $props();
	let stockPreview = $state(false);
	// The pages are prerendered, so the date window is checked in the browser after load.
	let clientNow = $state<number | null>(null);
	const now = $derived(context.now ?? clientNow);
	const visibleCards = $derived(
		slice.primary.cards.filter(
			(card) =>
				!(
					card.remove_items === true &&
					asText(card.title).trim() === 'Currently Unavailable. Sorry!' &&
					!isFilled.image(card.image) &&
					!isFilled.richText(card.price) &&
					!isFilled.richText(card.text) &&
					!isFilled.richText(card.notes)
				)
		)
	);

	onMount(() => {
		stockPreview = new URLSearchParams(window.location.search).get('stock-preview') === '1';
		clientNow = Date.now();
	});

	// A "New since" date in Prismic decides NEW by itself; without one, the stock feed decides.
	function showNew(card: (typeof slice.primary.cards)[number], stock: unknown) {
		if (card.new_since) {
			return context.newDays !== undefined && now !== null
				? isNewWithin(card.new_since, context.newDays, now)
				: false;
		}
		return (
			typeof stock === 'object' && stock !== null && (stock as WebsiteMenuStockItem).isNew === true
		);
	}

	const sectionId = isFilled.richText(slice.primary.heading)
		? asText(slice.primary.heading)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/(^-|-$)/g, '')
		: undefined;
</script>

<div class="bg-ink-noise relative grid scroll-mt-40 gap-12 p-4" id={sectionId}>
	{#if isFilled.richText(slice.primary.heading)}
		<Heading
			class="flex flex-col items-center justify-center rounded-xl py-2 text-center font-display font-black text-chalk drop-shadow-2xl"
		>
			<PrismicText field={slice.primary.heading} />
		</Heading>
	{/if}
	<ul class="grid gap-12 rounded-xl p-8 drop-shadow-2xl lg:grid-cols-2">
		{#each visibleCards as card, index}
			{@const titleKey = websiteMenuKey(asText(card.title))}
			{@const stock = context.stockByKey?.[titleKey]}
			<MenuItems
				{card}
				previewUnavailable={stockPreview && index === 0}
				liveUnavailable={typeof stock === 'boolean' ? stock : (stock?.unavailable ?? false)}
				liveNew={showNew(card, stock)}
				previewNew={stockPreview && index <= 1}
			/>
		{/each}
	</ul>
</div>
