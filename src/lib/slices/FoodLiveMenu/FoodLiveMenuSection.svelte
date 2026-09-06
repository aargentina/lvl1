<script lang="ts">
	import { asText, isFilled, type Content } from '@prismicio/client';
	import { PrismicText } from '@prismicio/svelte';

	import Heading from '$lib/components/Heading.svelte';
	import { websiteMenuKey, type WebsiteMenuStockItem } from '$lib/menuStock';
	import FoodLiveMenuCard from './FoodLiveMenuCard.svelte';

	interface Props {
		slice: Content.ImageCardsSlice;
		context?: { stockByKey?: Record<string, WebsiteMenuStockItem>; stockPreview?: boolean };
	}

	let { slice, context = {} }: Props = $props();

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
			{@const stock = context.stockByKey?.[websiteMenuKey(asText(card.title))]}
			<FoodLiveMenuCard
				{card}
				liveUnavailable={stock?.unavailable ?? false}
				liveNew={stock?.isNew === true}
				previewUnavailable={context.stockPreview === true && index === 0}
				previewNew={context.stockPreview === true && index <= 1}
			/>
		{/each}
	</ul>
</div>
