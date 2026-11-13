<script lang="ts">
	import ShopNav from '$lib/components/ShopNav.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function money(value: { amount: string; currencyCode: string }) {
		return new Intl.NumberFormat('en-CA', {
			style: 'currency',
			currency: value.currencyCode,
			currencyDisplay: 'narrowSymbol'
		}).format(Number(value.amount));
	}
</script>

<ShopNav />

<section
	class="relative overflow-hidden border-b-4 border-red bg-ink px-6 py-14 font-body text-chalk lg:px-10 lg:py-20"
>
	{#if data.shopSettings.banner}
		<img
			src={data.shopSettings.banner.url}
			alt=""
			class="absolute inset-0 h-full w-full object-cover opacity-10"
		/>
	{/if}
	<div class="relative mx-auto max-w-7xl">
		<p class="text-chalk/70 mb-4 text-xs font-black uppercase tracking-[0.18em]">
			Level One Game Pub
		</p>
		<h1 class="font-display text-5xl font-black tracking-[0.03em] sm:text-6xl lg:text-7xl">
			{data.shopSettings.heading}
		</h1>
		{#if data.shopSettings.intro}
			<p class="text-chalk/80 mt-6 max-w-2xl whitespace-pre-line text-base leading-7">
				{data.shopSettings.intro}
			</p>
		{/if}
	</div>
</section>

<section
	class="mx-auto max-w-7xl px-6 py-12 font-body text-chalk lg:px-10 lg:py-16"
	aria-labelledby="products-heading"
>
	{#if data.shopSettings.notice}
		<aside
			aria-label="Shop notice"
			class="bg-chalk/5 mb-8 rounded-xl border-l-4 border-red px-6 py-5"
		>
			<p class="whitespace-pre-line text-base leading-7">{data.shopSettings.notice}</p>
		</aside>
	{/if}
	<h2 id="products-heading" class="mb-8 font-display text-3xl font-black sm:text-4xl">
		{data.collection.title}
	</h2>
	{#if data.collection.products.length > 0}
		<div class="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.collection.products as product (product.id)}
				<article
					class="border-chalk/15 flex h-full flex-col overflow-hidden rounded-xl border bg-ink"
				>
					<a
						href="/shop/{encodeURIComponent(product.handle)}"
						tabindex="-1"
						aria-hidden="true"
						class="bg-chalk/5 relative block aspect-[4/3] overflow-hidden"
					>
						{#if product.featuredImage}
							<img
								src={product.featuredImage.url}
								alt=""
								loading="lazy"
								class="h-full w-full object-contain"
							/>
						{:else}
							<div
								class="text-chalk/40 flex h-full items-center justify-center px-6 font-display text-3xl font-black"
							>
								Level One
							</div>
						{/if}
						{#if !product.availableForSale}
							<span
								class="absolute bottom-4 left-4 rounded bg-ivory px-3 py-1 text-xs font-black uppercase tracking-wider text-ink"
								>Sold out</span
							>
						{/if}
					</a>
					<div class="flex flex-1 flex-col p-6">
						<h3 class="font-display text-xl leading-snug">
							<a
								href="/shop/{encodeURIComponent(product.handle)}"
								class="underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
								>{product.title}</a
							>
						</h3>
						{#if !product.availableForSale}
							<p class="sr-only">Sold out</p>
						{/if}
						<p class="text-chalk/70 mt-4 line-clamp-3 text-sm leading-6">{product.description}</p>
						<div
							class="border-chalk/15 mt-auto flex flex-wrap items-end justify-between gap-4 border-t pt-5"
						>
							<p class="mt-6">
								<span class="price-display text-xl font-black"
									>{money(
										product.priceRange.minVariantPrice
									)}{#if product.priceRange.minVariantPrice.amount !== product.priceRange.maxVariantPrice.amount}
										– {money(product.priceRange.maxVariantPrice)}{/if}</span
								>
								<span class="text-chalk/65 mt-1 block text-xs"
									>{product.priceRange.minVariantPrice.currencyCode}</span
								>
							</p>
							<a
								href="/shop/{encodeURIComponent(product.handle)}"
								class="inline-flex min-h-11 items-center justify-center rounded bg-gradient-to-r from-red to-red-bright px-5 py-3 font-heading text-sm text-chalk hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
								>View item<span class="sr-only">: {product.title}</span></a
							>
						</div>
					</div>
				</article>
			{/each}
		</div>
		{#if data.collection.pageInfo.hasNextPage && data.collection.pageInfo.endCursor}
			<div class="mt-10 flex flex-wrap gap-6">
				<a
					href="/shop?after={encodeURIComponent(data.collection.pageInfo.endCursor)}"
					class="border-chalk/50 inline-flex min-h-11 items-center rounded border px-6 py-3 font-black underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
					>Next items →</a
				>
				<a
					href="/shop"
					class="inline-flex min-h-11 items-center font-black underline-offset-4 hover:underline"
					>First items</a
				>
			</div>
		{/if}
	{:else}
		<div class="border-chalk/15 rounded-xl border px-6 py-12 text-center">
			<p class="text-lg">There are no items in the shop at this time.</p>
			<a
				href="/shop"
				class="mr-6 mt-5 inline-flex min-h-11 items-center font-black underline underline-offset-4"
				>First items</a
			>
			<a
				href="/events"
				class="mt-5 inline-flex min-h-11 items-center font-black underline underline-offset-4"
				>See our events →</a
			>
		</div>
	{/if}
	<p class="text-chalk/65 mt-8 text-sm">Final tax and delivery costs are calculated at checkout.</p>
</section>
