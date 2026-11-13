<script lang="ts">
	import { enhance } from '$app/forms';
	import ShopNav from '$lib/components/ShopNav.svelte';
	import type { ShopProduct, ShopScope } from '$lib/shop';

	let {
		data,
		form,
		scope = 'shop'
	}: {
		data: { product: ShopProduct };
		form?: { message?: string } | null;
		scope?: ShopScope;
	} = $props();
	let selectedVariantId = $state<string | null>(null);
	let adding = $state(false);
	const selectedVariant = $derived(
		data.product.variants.find((variant) => variant.id === selectedVariantId) ??
			data.product.variants.find((variant) => variant.availableForSale) ??
			data.product.variants[0]
	);
	const image = $derived(selectedVariant?.image ?? data.product.featuredImage);
	const canAdd = $derived(
		data.product.availableForSale && selectedVariant?.availableForSale === true
	);

	function money(value: { amount: string; currencyCode: string }) {
		return new Intl.NumberFormat('en-CA', {
			style: 'currency',
			currency: value.currencyCode,
			currencyDisplay: 'narrowSymbol'
		}).format(Number(value.amount));
	}
</script>

<ShopNav {scope} />

<section class="mx-auto max-w-7xl px-6 py-8 font-body text-chalk lg:px-10 lg:py-12">
	<a
		href={scope === 'booking' ? '/contact' : '/shop'}
		class="inline-flex min-h-11 items-center text-sm font-black underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
		>{scope === 'booking' ? 'Contact us' : '← Back to shop'}</a
	>
	<div class="mt-7 grid items-start gap-9 lg:grid-cols-2 lg:gap-14">
		<div class="border-chalk/15 bg-chalk/5 overflow-hidden rounded-xl border">
			{#if image}
				<img
					src={image.url}
					alt={image.altText || data.product.title}
					class="aspect-square h-auto w-full object-contain"
				/>
			{:else}
				<div
					class="text-chalk/40 flex aspect-square items-center justify-center px-8 font-display text-4xl font-black"
				>
					Level One
				</div>
			{/if}
		</div>
		<div>
			<p class="text-chalk/65 text-xs font-black uppercase tracking-[0.18em]">
				{scope === 'booking' ? 'Reservation booking' : 'Level One Shop'}
			</p>
			<h1 class="mt-4 break-words font-display text-4xl font-black leading-tight sm:text-5xl">
				{data.product.title}
			</h1>
			<p class="mt-6">
				<span class="price-display text-3xl font-black"
					>{money(selectedVariant?.price ?? data.product.priceRange.minVariantPrice)}</span
				>
				<span class="text-chalk/65 ml-2 text-sm"
					>{(selectedVariant?.price ?? data.product.priceRange.minVariantPrice).currencyCode}</span
				>
			</p>
			<div role="status" aria-live="polite" aria-atomic="true">
				{#if !canAdd}
					<p
						class="mt-5 inline-block rounded bg-ivory px-3 py-1 text-sm font-black uppercase tracking-wider text-ink"
					>
						Sold out
					</p>
				{:else if data.product.variants.length > 1}
					<p class="sr-only">{selectedVariant?.title} is available.</p>
				{/if}
			</div>
			{#if data.product.description}
				<p class="text-chalk/80 mt-7 whitespace-pre-line leading-7">{data.product.description}</p>
			{/if}
			<form
				method="POST"
				action="?/add"
				class="border-chalk/15 mt-8 border-t pt-7"
				use:enhance={() => {
					adding = true;
					return async ({ update }) => {
						try {
							await update();
						} finally {
							adding = false;
						}
					};
				}}
			>
				{#if data.product.variants.length > 1}
					<label for="variant" class="mb-2 block text-sm font-black">Choose an option</label>
					<select
						id="variant"
						name="variantId"
						value={selectedVariant?.id}
						onchange={(event) => (selectedVariantId = event.currentTarget.value)}
						disabled={adding}
						class="border-chalk/50 mb-5 min-h-12 w-full rounded border bg-ink px-4 py-3 text-chalk focus:border-chalk focus:ring-chalk"
					>
						{#each data.product.variants as variant (variant.id)}
							<option value={variant.id}
								>{variant.title}{variant.availableForSale ? '' : ' — Sold out'}</option
							>
						{/each}
					</select>
				{:else}
					<input type="hidden" name="variantId" value={selectedVariant?.id ?? ''} />
				{/if}
				<label for="quantity" class="mb-2 block text-sm font-black">Quantity</label>
				<div class="flex flex-wrap items-stretch gap-3">
					<input
						id="quantity"
						name="quantity"
						type="number"
						min="1"
						max="99"
						step="1"
						value="1"
						required
						disabled={!canAdd || adding}
						class="border-chalk/50 min-h-12 w-24 rounded border bg-ink px-3 text-chalk focus:border-chalk focus:ring-chalk disabled:opacity-50"
					/>
					<button
						type="submit"
						disabled={!canAdd || adding}
						class="inline-flex min-h-12 flex-1 items-center justify-center rounded bg-gradient-to-r from-red to-red-bright px-6 py-3 font-heading text-base text-chalk hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
						>{adding ? 'Adding…' : canAdd ? 'Add to cart' : 'Sold out'}</button
					>
				</div>
				{#if form?.message}
					<p
						role="alert"
						class="mt-5 rounded border border-red-bright bg-ivory px-4 py-3 text-sm text-ink"
					>
						{form.message}
					</p>
				{/if}
				<p class="text-chalk/65 mt-5 text-sm leading-6">
					Final tax and delivery costs are calculated at checkout.
				</p>
			</form>
		</div>
	</div>
</section>
