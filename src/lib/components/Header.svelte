<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import logo from '$lib/assets/logo/no-neon.png';
	import bigLogo from '$lib/assets/logo/big-no-neon.png';
	import { page } from '$app/stores';

	let links = $derived($page.data.links);

	let open = $state(false);

	function close() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<link rel="preload" as="image" href={bigLogo} />
</svelte:head>

<!-- Keeps `nav.fixed` so MenuNav can measure header height -->
<nav aria-label="Main" class="fixed left-0 top-0 z-50 w-full bg-ink py-1">
	<div
		class="relative grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 2xl:flex 2xl:justify-between 2xl:px-10"
	>
		<button
			class="justify-self-start text-chalk 2xl:hidden"
			aria-label="Toggle menu"
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			<svg
				class="h-7 w-7"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
			>
				{#if open}
					<path d="M6 6l12 12M18 6L6 18" />
				{:else}
					<path d="M5 7h14M5 12h14M5 17h14" />
				{/if}
			</svg>
		</button>

		<a href="/" class="shrink-0 justify-self-center" onclick={close}>
			<img src={logo} alt="Level One Game Pub" class="h-7 w-auto sm:h-10 2xl:h-12" />
		</a>

		<ul
			class="hidden min-w-0 flex-1 items-center justify-center gap-6 font-body text-base text-chalk 2xl:flex"
		>
			{#each links as item}
				<li class="shrink-0">
					<a href={item.href} class="transition-colors hover:text-red-bright">{item.label}</a>
				</li>
			{/each}
		</ul>

		<div
			class="-mr-0.5 inline-block shrink-0 justify-self-end rounded bg-gradient-to-r from-red to-red-bright px-2 py-1 text-center font-heading text-xs leading-tight tracking-tighter text-ivory shadow-[4px_4px_0px_#191412] sm:mr-0 sm:px-3 sm:py-1.5 sm:text-sm sm:leading-normal sm:tracking-normal"
		>
			$10 Stay &amp;<br class="sm:hidden" /> Play*
		</div>
	</div>
</nav>

{#if open}
	<div
		class="bg-ink/60 fixed inset-0 z-40 2xl:hidden"
		onclick={close}
		transition:fade={{ duration: 150 }}
		role="presentation"
	></div>
	<ul
		class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col gap-1 overflow-y-auto bg-ink px-6 pb-6 pt-20 font-heading text-lg text-chalk 2xl:hidden"
		transition:fly={{ x: -288, duration: 200 }}
	>
		<li class="mb-4 flex justify-center">
			<img src={bigLogo} alt="Level One Game Pub" width="320" height="259" class="h-auto w-44" />
		</li>
		{#each links as item}
			<li>
				<a href={item.href} class="block py-2 hover:text-red-bright" onclick={close}>
					{item.label}
				</a>
			</li>
		{/each}
	</ul>
{/if}
