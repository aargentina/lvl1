<script lang="ts">
	import { isFilled, type Content } from '@prismicio/client';
	import { PrismicImage, PrismicLink } from '@prismicio/svelte';

	import PrismicRichText from '$lib/components/PrismicRichText.svelte';
	import Bounded from '$lib/components/Bounded.svelte';

	interface Props {
		card: Content.GridSelectSliceDefaultPrimaryGridgroupItem;
	}

	let { card }: Props = $props();
</script>

<!--Affects photo size-->
<li
	class="relative rounded-xl py-11 transition-shadow duration-300 ease-in-out md:py-16 [@media(hover:hover)]:hover:shadow-lg [@media(hover:hover)]:hover:shadow-red/40"
>
	{#if isFilled.link(card.gridlink)}
		<PrismicLink field={card.gridlink} aria-hidden="true" tabindex={-1}>
			{#if isFilled.image(card.gridimage)}
				<PrismicImage
					field={card.gridimage}
					class="absolute inset-0 h-full w-full rounded-xl object-cover opacity-80 shadow-2xl"
				/>
				<div class="absolute inset-0 left-1/2 h-full w-full -translate-x-1/2 rounded-xl bg-ink/40"></div>
			{/if}
		</PrismicLink>
	{/if}
	<Bounded tag="div" yPadding="base" class="z-10 grid justify-center">
		{#if isFilled.link(card.gridlink)}
			<PrismicLink field={card.gridlink}>
				<!--				Inner text box-->
				<div
					class="h-min w-min max-w-full rounded-xl bg-gradient-to-br from-red to-red-bright px-4 py-4 text-center text-chalk drop-shadow-2xl max-md:[&_:is(h1,h2,h3)]:text-2xl md:px-6 md:text-nowrap"
				>
					<PrismicRichText field={card.image_text} />
				</div>
			</PrismicLink>
		{/if}
	</Bounded>
</li>
