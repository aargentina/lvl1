<script lang="ts">
	import { isFilled, asText, type Content } from '@prismicio/client';
	import { PrismicText } from '@prismicio/svelte';
	import { onMount } from 'svelte';

	import MenuItems from './MenuItems.svelte';
	import Heading from '$lib/components/Heading.svelte';
	import { websiteMenuKey } from '$lib/menuStock';

	interface Props {
		slice: Content.ImageCardsSlice;
		context?: { stockByKey?: Record<string, boolean> };
	}

	let { slice, context = {} }: Props = $props();
	let stockPreview = $state(false);
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
	});

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
			<MenuItems
				{card}
				previewUnavailable={stockPreview && index === 0}
				liveUnavailable={context.stockByKey?.[titleKey] ?? false}
			/>
		{/each}
	</ul>
</div>
