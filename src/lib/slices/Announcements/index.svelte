<script lang="ts">
	import { isFilled, asText, asLink, type Content } from '@prismicio/client';
	import { PrismicImage } from '@prismicio/svelte';

	interface Props {
		slice: Content.AnnouncementsSlice;
	}

	const { slice }: Props = $props();
	const cards = $derived(slice.primary.cards);

	let track: HTMLDivElement | undefined = $state();
	let cardEls: HTMLElement[] = $state([]);
	let active = $state(0);

	function goTo(i: number) {
		cardEls[i]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
	}

	$effect(() => {
		if (!track) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const i = cardEls.indexOf(entry.target as HTMLElement);
						if (i !== -1) active = i;
					}
				}
			},
			{ root: track, threshold: 0.6 }
		);
		for (const el of cardEls) if (el) observer.observe(el);
		return () => observer.disconnect();
	});
</script>

<!-- ponytail: no cards = no section, so the client can empty it instead of removing the slice -->
{#if cards.length}
	<section
		data-slice-type={slice.slice_type}
		data-slice-variation={slice.variation}
		class="px-6 py-14 lg:px-16"
	>
		<div class="mb-8">
			<h2 class="font-display text-3xl font-black tracking-[0.05em] text-chalk lg:text-4xl">
				Announcements
			</h2>
		</div>

		<div
			bind:this={track}
			class="flex snap-x snap-mandatory gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			{#each cards as card, i}
				<article
					bind:this={cardEls[i]}
					class="relative h-80 w-[85%] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.08] bg-ink sm:w-1/2 lg:w-1/3"
				>
					{#if isFilled.image(card.image)}
						<PrismicImage
							class="absolute inset-0 h-full w-full object-cover"
							field={card.image}
							sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 85vw"
						/>
					{/if}
					<div class="via-ink/40 absolute inset-0 bg-gradient-to-b from-transparent to-ink"></div>
					<div class="absolute inset-x-0 bottom-0 p-6">
						<h3 class="font-display text-xl font-normal text-chalk">{asText(card.title)}</h3>
						<p
							class="text-chalk/75 mt-2 line-clamp-3 min-h-[3.6rem] font-body text-sm leading-snug"
						>
							{asText(card.body)}
						</p>
						{#if isFilled.link(card.link)}
							<a
								href={asLink(card.link)}
								class="mt-3 inline-block font-heading text-sm text-red-bright"
							>
								{card.link.text || 'Learn more'} →
							</a>
						{/if}
					</div>
				</article>
			{/each}
		</div>

		{#if cards.length > 1}
			<div class="mt-8 flex items-center justify-center gap-2.5">
				{#each cards as _, i}
					<button
						type="button"
						aria-label={`Go to announcement ${i + 1}`}
						onclick={() => goTo(i)}
						class="rounded-full transition-all {active === i
							? 'h-2 w-6 bg-red-bright'
							: 'h-2 w-2 bg-white/25'}"
					></button>
				{/each}
			</div>
		{/if}
	</section>
{/if}
