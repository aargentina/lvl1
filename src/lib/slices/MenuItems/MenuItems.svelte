<script lang="ts">
	import { isFilled, type Content } from '@prismicio/client';
	import { PrismicImage } from '@prismicio/svelte';

	import PrismicRichText from '$lib/components/PrismicRichText.svelte';

	interface Props {
		card: Content.ImageCardsSliceDefaultPrimaryCardsItem;
		previewUnavailable?: boolean;
	}

	let { card, previewUnavailable = false }: Props = $props();
	const unavailable = $derived(card.remove_items || previewUnavailable);
</script>

<li
	class="grid w-full gap-8 rounded-xl font-body drop-shadow-2xl md:flex"
	class:opacity-70={unavailable}
>
	{#if isFilled.image(card.image)}
		<div class="">
			<PrismicImage class="rounded-xl drop-shadow-2xl" field={card.image} sizes="" />
		</div>
	{/if}
	<div class="grid h-full w-full grid-cols-2 text-pretty text-chalk">
		<div class="justify-items-start font-heading">
			<PrismicRichText field={card.title} />
			{#if unavailable}
				<span
					class="mt-2 inline-flex rounded-full bg-red-bright px-3 py-1 font-body text-xs font-black uppercase tracking-[0.12em] text-chalk"
				>
					Temporarily unavailable
				</span>
			{/if}
		</div>
		<div class="grid justify-items-end text-lg">
			<div class="price-display">
				<PrismicRichText field={card.price} />
			</div>
		</div>
		<div class="col-span-2 w-full">
			<div class="text-chalk/75">
				<PrismicRichText field={card.text} />
			</div>
			<div class="text-chalk/75 justify-items-center p-4 text-center">
				<PrismicRichText field={card.notes} />
			</div>
		</div>
	</div>
</li>
