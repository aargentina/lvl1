<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		sections: { label: string; id: string }[];
	}

	let { sections }: Props = $props();
	let activeId = $state(sections[0]?.id ?? '');
	let navEl: HTMLElement | undefined = $state();
	let scrollContainer: HTMLElement | undefined = $state();
	let headerHeight = $state(0);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	function updateScrollHints() {
		if (!scrollContainer) return;
		canScrollLeft = scrollContainer.scrollLeft > 0;
		canScrollRight =
			scrollContainer.scrollLeft + scrollContainer.clientWidth < scrollContainer.scrollWidth - 1;
	}

	onMount(() => {
		const header = document.querySelector('nav.fixed');
		if (header) {
			const updateHeight = () => {
				headerHeight = header.getBoundingClientRect().height;
			};
			updateHeight();
			window.addEventListener('resize', updateHeight);
		}

		updateScrollHints();
		scrollContainer?.addEventListener('scroll', updateScrollHints);
		window.addEventListener('resize', updateScrollHints);

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeId = entry.target.id;
						scrollActiveIntoView();
					}
				}
			},
			{ rootMargin: '-20% 0px -60% 0px' }
		);

		for (const section of sections) {
			const el = document.getElementById(section.id);
			if (el) observer.observe(el);
		}

		return () => {
			observer.disconnect();
			scrollContainer?.removeEventListener('scroll', updateScrollHints);
			window.removeEventListener('resize', updateScrollHints);
		};
	});

	function scrollTo(id: string) {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth' });
			activeId = id;
		}
	}

	function scrollActiveIntoView() {
		if (!scrollContainer) return;
		const activeBtn = scrollContainer.querySelector(`[data-section="${activeId}"]`);
		if (activeBtn instanceof HTMLElement) {
			activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
		}
	}
</script>

<nav
	bind:this={navEl}
	aria-label="Menu sections"
	class="fixed left-0 z-[9] w-full border-b border-white/10 bg-ink/95 backdrop-blur-sm"
	style="top: {headerHeight}px"
>
	<div class="relative">
		<div
			bind:this={scrollContainer}
			class="scrollbar-hide flex items-center gap-1 overflow-x-auto px-4 py-3"
		>
			{#each sections as section}
				<button
					data-section={section.id}
					onclick={() => scrollTo(section.id)}
					class="shrink-0 rounded-lg px-4 py-2 font-heading text-sm uppercase tracking-wider transition-colors
						{activeId === section.id
						? 'bg-gradient-to-r from-red to-red-bright text-chalk'
						: 'text-chalk/70 hover:bg-chalk/10 hover:text-chalk'}"
				>
					{section.label}
				</button>
			{/each}
		</div>
		<div
			class="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-ink to-transparent transition-opacity
				{canScrollLeft ? 'opacity-100' : 'opacity-0'}"
		></div>
		<div
			class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-ink to-transparent transition-opacity
				{canScrollRight ? 'opacity-100' : 'opacity-0'}"
		></div>
	</div>
</nav>

<style>
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
		justify-content: safe center;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
