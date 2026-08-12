<script lang="ts">
	import { isFilled, asText, type Content } from '@prismicio/client';
	import { PrismicText } from '@prismicio/svelte';
	import { onMount } from 'svelte';

	import MenuItems from './MenuItems.svelte';
	import Heading from '$lib/components/Heading.svelte';

	interface Props {
		slice: Content.ImageCardsSlice;
	}

	let { slice }: Props = $props();
	let stockPreview = $state(false);

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
		{#each slice.primary.cards as card, index}
			<MenuItems {card} previewUnavailable={stockPreview && index === 0} />
		{/each}
	</ul>
</div>
