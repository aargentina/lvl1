<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ShopNav from '$lib/components/ShopNav.svelte';
	import { shopRoot, type ShopCart, type ShopScope } from '$lib/shop';

	let {
		data,
		form,
		scope = 'shop'
	}: {
		data: {
			cart: ShopCart | null;
			notice: string | null;
			checkoutBlocked: boolean;
			checkoutMessage?: string | null;
			returnHandle?: string | null;
		};
		form?: { message?: string } | null;
		scope?: ShopScope;
	} = $props();
	const root = $derived(shopRoot(scope));
	const continueHref = $derived(
		scope === 'booking'
			? data.returnHandle
				? `${root}/${encodeURIComponent(data.returnHandle)}`
				: '/contact'
			: '/shop'
	);
	let pending = $state(false);
	const hasItems = $derived((data.cart?.lines.length ?? 0) > 0);
	const submit: SubmitFunction = () => {
		pending = true;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				pending = false;
			}
		};
	};

	function money(value: { amount: string; currencyCode: string }) {
		return new Intl.NumberFormat('en-CA', {
			style: 'currency',
			currency: value.currencyCode,
			currencyDisplay: 'narrowSymbol'
		}).format(Number(value.amount));
	}
</script>

<ShopNav current="cart" {scope} />

<section
	class="mx-auto max-w-7xl px-6 py-10 font-body text-chalk lg:px-10 lg:py-16"
	aria-labelledby="cart-heading"
	aria-busy={pending}
>
	<div class="mb-8 flex flex-wrap items-center justify-between gap-4">
		<h1 id="cart-heading" class="font-display text-4xl font-black sm:text-5xl">
			{scope === 'booking' ? 'Your booking cart' : 'Your cart'}
		</h1>
		<a
			href={continueHref}
			class="inline-flex min-h-11 items-center text-sm font-black underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
			>{scope === 'booking'
				? data.returnHandle
					? 'Back to booking →'
					: 'Contact us →'
				: 'Continue shopping →'}</a
		>
	</div>
	{#if data.notice}
		<p
			role="status"
			class="border-chalk/30 bg-chalk/10 mb-6 rounded border px-5 py-4 text-sm leading-6"
		>
			{data.notice}
		</p>
	{/if}
	{#if form?.message}
		<p
			role="alert"
			class="mb-6 rounded border border-red-bright bg-ivory px-5 py-4 text-sm leading-6 text-ink"
		>
			{form.message}
		</p>
	{/if}
	{#if hasItems && data.cart}
		<div class="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<div class="divide-chalk/15 border-chalk/15 divide-y border-y">
				{#each data.cart.lines as line (line.id)}
					<article
						class="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-6 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6"
						aria-label={line.variant.product.title}
					>
						<a
							href="{root}/{encodeURIComponent(line.variant.product.handle)}"
							tabindex="-1"
							aria-hidden="true"
							class="bg-chalk/5 block aspect-square overflow-hidden rounded-lg"
						>
							{#if line.variant.image}
								<img src={line.variant.image.url} alt="" class="h-full w-full object-contain" />
							{:else}
								<span
									class="text-chalk/40 flex h-full items-center justify-center text-center font-display text-sm"
									>Level One</span
								>
							{/if}
						</a>
						<div class="min-w-0">
							<h2 class="break-words font-display text-xl leading-snug">
								<a
									href="{root}/{encodeURIComponent(line.variant.product.handle)}"
									class="underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
									>{line.variant.product.title}</a
								>
							</h2>
							{#if line.variant.title && line.variant.title !== 'Default Title'}
								<p class="text-chalk/65 mt-2 text-sm">{line.variant.title}</p>
							{/if}
							<p class="mt-3 text-sm">
								<span class="price-display font-black"
									>{money(line.variant.price)} {line.variant.price.currencyCode}</span
								> <span class="text-chalk/65">each</span>
							</p>
							<div class="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
								<form
									method="POST"
									action="?/update"
									use:enhance={submit}
									class="flex flex-wrap items-end gap-2"
								>
									<input type="hidden" name="lineId" value={line.id} />
									<div>
										<label for="quantity-{line.id}" class="mb-1 block text-xs font-black"
											>Quantity<span class="sr-only"> for {line.variant.product.title}</span></label
										>
										<input
											id="quantity-{line.id}"
											name="quantity"
											type="number"
											min="1"
											max="99"
											step="1"
											value={Math.min(line.quantity, 99)}
											required
											disabled={pending}
											class="border-chalk/50 min-h-11 w-20 rounded border bg-ink px-3 text-chalk focus:border-chalk focus:ring-chalk disabled:opacity-50"
										/>
									</div>
									<button
										type="submit"
										disabled={pending}
										class="border-chalk/50 hover:bg-chalk/10 min-h-11 rounded border px-4 text-sm font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk disabled:cursor-wait disabled:opacity-50"
										>Update<span class="sr-only"> {line.variant.product.title}</span></button
									>
								</form>
								<form method="POST" action="?/remove" use:enhance={submit}>
									<input type="hidden" name="lineId" value={line.id} />
									<button
										type="submit"
										disabled={pending}
										class="hover:text-chalk/70 min-h-11 text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk disabled:cursor-wait disabled:opacity-50"
										>Remove<span class="sr-only"> {line.variant.product.title}</span></button
									>
								</form>
							</div>
							{#if line.quantity > 99}
								<p role="status" class="mt-3 text-sm">
									This cart has {line.quantity} of this option. Set its quantity to 99 or fewer.
								</p>
							{/if}
						</div>
					</article>
				{/each}
			</div>
			<aside class="border-chalk/15 rounded-xl border bg-ink p-6" aria-labelledby="summary-heading">
				<h2 id="summary-heading" class="font-display text-2xl">Order summary</h2>
				<p
					class="border-chalk/15 mt-6 flex flex-wrap items-baseline justify-between gap-3 border-t pt-5"
				>
					<span>Subtotal</span><strong class="price-display text-xl"
						>{money(data.cart.cost.subtotalAmount)}
						<span class="text-xs font-normal">{data.cart.cost.subtotalAmount.currencyCode}</span
						></strong
					>
				</p>
				<p class="text-chalk/65 mt-4 text-sm leading-6">
					Final tax and delivery costs are calculated at checkout.
				</p>
				{#if data.checkoutBlocked}
					<p role="status" class="mt-5 text-sm leading-6">
						{data.checkoutMessage || 'An item is no longer available. Remove it before checkout.'}
					</p>
				{/if}
				<form method="POST" action="?/checkout" class="mt-6">
					<button
						type="submit"
						disabled={pending || data.checkoutBlocked}
						class="flex min-h-12 w-full items-center justify-center rounded bg-gradient-to-r from-red to-red-bright px-5 py-3 font-heading text-base text-chalk hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
						>{pending ? 'Please wait…' : 'Go to checkout'}</button
					>
				</form>
			</aside>
		</div>
	{:else}
		<div class="border-chalk/15 rounded-xl border px-6 py-14 text-center">
			<p class="text-xl">Your cart is empty.</p>
			{#if scope === 'booking'}<p class="mt-4">
					{data.returnHandle
						? 'Return to your booking to add your reservation.'
						: 'Open the booking link we sent you to add your reservation.'}
				</p>{/if}
			<a
				href={continueHref}
				class="mt-7 inline-flex min-h-12 items-center justify-center rounded bg-gradient-to-r from-red to-red-bright px-7 py-3 font-heading text-base hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
				>{scope === 'booking'
					? data.returnHandle
						? 'Back to booking'
						: 'Contact us'
					: 'Go to shop'}</a
			>
		</div>
	{/if}
	<p role="status" aria-live="polite" class="text-chalk/70 mt-5 min-h-6 text-sm">
		{pending ? 'Updating your cart…' : ''}
	</p>
</section>
