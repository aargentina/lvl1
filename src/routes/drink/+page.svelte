<script lang="ts">
	import { asText, type Content } from '@prismicio/client';
	import { SliceZone } from '@prismicio/svelte';

	import { components } from '$lib/slices';
	import MenuNav from '$lib/components/MenuNav.svelte';

	let { data } = $props();

	const menuSlices = $derived(
		data.page.data.slices.filter((s) => s.slice_type === 'image_cards') as Content.ImageCardsSlice[]
	);

	const sections = $derived(
		menuSlices
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
			.filter((s) => s.label)
	);
</script>

{#if sections.length > 0}
	<MenuNav {sections} />
	<div class="pt-14"></div>
{/if}

<h1 class="mx-auto max-w-6xl px-6 pt-8 font-display text-4xl font-bold text-chalk">Drinks Menu</h1>

<SliceZone slices={data.page.data.slices} {components} />
