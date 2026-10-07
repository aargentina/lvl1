<script lang="ts">
	import { asText, type Content } from '@prismicio/client';
	import { SliceZone } from '@prismicio/svelte';
	import { page } from '$app/stores';

	import { components } from '$lib/slices';
	import MenuNav from '$lib/components/MenuNav.svelte';
	import { NEW_DAYS } from '$lib/menuNew';

	let { data } = $props();

	const menuSlices = data.page.data.slices.filter(
		(s) => s.slice_type === 'image_cards'
	) as Content.ImageCardsSlice[];

	const sections = menuSlices
		.map((slice) => {
			const label = asText(slice.primary.heading);
			return {
				label,
				id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
			};
		})
		.filter((s) => s.label);
</script>

<svelte:head>
	<title>{$page.data.title}</title>
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

<SliceZone slices={data.page.data.slices} {components} context={{ newDays: NEW_DAYS.drink }} />
