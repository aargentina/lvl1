<script lang="ts">
	import { asText, type Content } from '@prismicio/client';
	import { SliceZone } from '@prismicio/svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	import { components } from '$lib/slices';
	import MenuNav from '$lib/components/MenuNav.svelte';

	let { data } = $props();
	let stockPreview = $state(false);

	onMount(() => {
		stockPreview = new URLSearchParams(window.location.search).get('stock-preview') === '1';
	});

	const menuSlices = data.page.data.slices.filter(
		(s) => s.slice_type === 'image_cards'
	) as Content.ImageCardsSlice[];

	const sections = menuSlices
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

{#if stockPreview}
	<div class="border-y-4 border-red bg-ivory px-4 py-3 text-center font-body text-sm text-ink">
		<strong>Stock label preview:</strong> Sample items are marked as unavailable. This page uses demo
		data only.
	</div>
{/if}

<SliceZone slices={data.page.data.slices} {components} />
