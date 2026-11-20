<script lang="ts">
	import type { Content } from '@prismicio/client';

	import PrismicRichText from '$lib/components/PrismicRichText.svelte';

	import BgSearch from '$lib/components/bgsearch.svelte';

	interface Props {
		slice: Content.SearchSlice;
	}

	let { slice } = $props();
</script>

<svelte:head>
	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "WebPage",
			"name": "Board Game Search",
			"description": "Search and discover board games by category, player count, and more. Find your next favorite game from our extensive collection.",
			"mainEntity": {
				"@type": "WebApplication",
				"name": "Board Game Search Tool",
				"description": "Interactive search tool for board games with category filtering and real-time results",
				"applicationCategory": "EntertainmentApplication",
				"operatingSystem": "Web Browser"
			}
		}
	</script>
</svelte:head>

<div class="flex justify-center bg-ink-noise font-body text-chalk">
	<div data-slice-type={slice.slice_type} data-slice-variation={slice.variation} class="w-4/5">
		{#if slice.primary?.search}
			<PrismicRichText field={slice.primary.search} />
		{/if}
		<BgSearch />
	</div>
</div>
