<script lang="ts">
	import { isFilled, asText, type Content } from '@prismicio/client';
	import { PrismicText } from '@prismicio/svelte';

	import MenuItems from './MenuItems.svelte';
	import Heading from '$lib/components/Heading.svelte';

	interface Props {
		slice: Content.ImageCardsSlice;
	}

	let { slice }: Props = $props();

	const sectionId = isFilled.richText(slice.primary.heading)
		? asText(slice.primary.heading)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/(^-|-$)/g, '')
		: undefined;
</script>

<div class="relative grid gap-12 bg-ink-noise p-4 scroll-mt-40" id={sectionId}>
	{#if isFilled.richText(slice.primary.heading)}
		<Heading
			tag="h2"
			class="flex flex-col items-center justify-center text-center rounded-xl py-2 font-display font-black text-chalk drop-shadow-2xl"
		>
			<PrismicText field={slice.primary.heading} />
		</Heading>
	{/if}
	<ul
		class="grid gap-12 rounded-xl p-8 drop-shadow-2xl lg:grid-cols-2"
	>
		{#each slice.primary.cards as card}
			{#if !card.remove_items}
				<MenuItems {card} />
			{/if}
		{/each}
	</ul>
</div>
