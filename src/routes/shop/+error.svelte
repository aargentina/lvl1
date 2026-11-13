<script lang="ts">
	import { page } from '$app/stores';
	import ShopNav from '$lib/components/ShopNav.svelte';
</script>

<svelte:head
	><title>Shop | Level One Game Pub</title><meta name="robots" content="noindex" /></svelte:head
>

<ShopNav />

<section class="mx-auto max-w-3xl px-6 py-16 font-body text-chalk lg:py-24">
	<h1 class="font-display text-4xl font-black sm:text-5xl">
		{$page.status === 404
			? 'Item not found'
			: $page.status === 400
				? 'Check the shop link'
				: 'Shop unavailable'}
	</h1>
	<p class="text-chalk/80 mt-7 text-lg leading-8">
		{$page.status === 404
			? 'This item is not available in the shop.'
			: $page.status === 400
				? $page.error?.message || 'This shop page link is not valid.'
				: 'We could not check the shop at this time. Please try again.'}
	</p>
	<a
		href="/shop"
		class="mt-8 inline-flex min-h-12 items-center justify-center rounded bg-gradient-to-r from-red to-red-bright px-7 py-3 font-heading hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
		>Back to shop</a
	>
</section>
