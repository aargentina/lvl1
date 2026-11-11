<script lang="ts">
	import { isFilled, type Content } from '@prismicio/client';
	import type { SliceComponentProps } from '@prismicio/svelte';

	type Props = SliceComponentProps<Content.VideoSlice>;

	const { slice }: Props = $props();

	let videoReady = $state(false);

	function getVimeoEmbedUrl(url: string): string | null {
		// Match video ID and optional privacy hash
		// Formats: vimeo.com/123456789, vimeo.com/123456789/abc123, player.vimeo.com/video/123456789?h=abc123
		const pattern = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)(?:\/([a-zA-Z0-9]+))?/;
		const match = url.match(pattern);
		if (match) {
			const videoId = match[1];
			const hashFromPath = match[2];
			const hashFromQuery = new URL(url).searchParams.get('h');
			const hash = hashFromPath || hashFromQuery;

			// background=1: autoplay, mute, loop, no controls
			// dnt=1: do not track (reduces requests)
			// quality=auto: let Vimeo pick optimal quality
			let embedUrl = `https://player.vimeo.com/video/${videoId}?background=1&autoplay=1&loop=1&muted=1&playsinline=1&dnt=1&quality=auto`;
			if (hash) {
				embedUrl += `&h=${hash}`;
			}
			return embedUrl;
		}
		return null;
	}

	function handleIframeLoad() {
		// Wait for Vimeo player to fully initialize after iframe loads
		setTimeout(() => {
			videoReady = true;
		}, 1500);
	}

	const embedUrl = $derived(
		isFilled.link(slice.primary.videolink) && slice.primary.videolink.url
			? getVimeoEmbedUrl(slice.primary.videolink.url)
			: null
	);

	const posterUrl = $derived(
		isFilled.image(slice.primary.poster) ? slice.primary.poster.url : null
	);
</script>

<section
	data-slice-type={slice.slice_type}
	data-slice-variation={slice.variation}
	class="bg-ink-noise relative -mt-24 h-screen w-screen md:-mt-20"
	style="margin-left: calc(-50vw + 50%);"
>
	<div class="absolute inset-0 overflow-hidden">
		{#if posterUrl}
			<img
				src={posterUrl}
				alt=""
				class="absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-screen min-w-[177.78vh] -translate-x-1/2 -translate-y-1/2 object-cover"
				loading="eager"
				fetchpriority="high"
			/>
		{/if}
		{#if embedUrl}
			<iframe
				class="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-screen min-w-[177.78vh] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700"
				class:opacity-0={!videoReady}
				class:opacity-100={videoReady}
				src={embedUrl}
				title="Background video"
				frameborder="0"
				allow="autoplay"
				loading="eager"
				onload={handleIframeLoad}
			></iframe>
		{/if}
	</div>
</section>
