<script lang="ts">
	import { isFilled, asText, type Content } from '@prismicio/client';
	import { PrismicText } from '@prismicio/svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';

	import MenuItems from './MenuItems.svelte';
	import Heading from '$lib/components/Heading.svelte';
	import { isSamplePreview, isStockRoute } from '$lib/menuStock';
	import { menuStock, startMenuStockPolling } from '$lib/menuStock.svelte';

	interface Props {
		slice: Content.ImageCardsSlice;
	}

	let { slice }: Props = $props();

	// The store outlives a client-side navigation, so every read is gated on the
	// page we are on now, not on where polling started.
	const stockEnabled = $derived(isStockRoute($page.url.pathname));
	// browser-only: these pages prerender, and a query string doesn't exist then.
	const preview = $derived(
		browser &&
			stockEnabled &&
			isSamplePreview($page.url.search, $page.data.stockPreviewAllowed === true)
	);

	$effect(() => {
		if (stockEnabled && !preview) startMenuStockPolling();
	});

	// ponytail: an 86'd card with no image, price, text or notes is a Prismic
	// placeholder ("Currently Unavailable. Sorry!"), not a real menu item.
	// Matching on emptiness instead of on the title survives a copy edit.
	const isPlaceholder = (card: Content.ImageCardsSliceDefaultPrimaryCardsItem) =>
		card.remove_items === true &&
		!isFilled.image(card.image) &&
		!isFilled.richText(card.price) &&
		!isFilled.richText(card.text) &&
		!isFilled.richText(card.notes);

	const visibleCards = $derived(
		slice.primary.cards.filter((card) => card.hidden !== true && !isPlaceholder(card))
	);

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
			tag="h2"
			class="flex flex-col items-center justify-center rounded-xl py-2 text-center font-display font-black text-chalk drop-shadow-2xl"
		>
			<PrismicText field={slice.primary.heading} />
		</Heading>
	{/if}
	<ul class="grid gap-12 rounded-xl p-8 drop-shadow-2xl lg:grid-cols-2">
		{#each visibleCards as card, index}
			<!-- Stock matches on the permanent Website Menu ID only: a card without
			     one is left unlabelled rather than matched on its editable title. -->
			{@const stockKey = stockEnabled ? card.website_menu_id?.trim() : ''}
			{@const stock = stockKey ? menuStock.byKey[stockKey] : undefined}
			<MenuItems
				{card}
				unavailable={card.remove_items === true ||
					stock?.unavailable === true ||
					(preview && index === 0)}
			/>
			<!-- "New" badge shelved at client request (2026-11). To restore, pass:
			     isNew={stock?.isNew === true || (preview && index <= 1)} -->
		{/each}
	</ul>
</div>
